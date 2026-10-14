import prismaClient from "../../prisma";
import { Appointments, Prisma } from "../../generated/prisma/client";
import { ConflictError } from "../../errors/app-error";

interface getAppointmentsOnDayProps {
  startDay: Date;
  endDay: Date;
}

interface hasConflictProps {
  end_time: Date;
  startHour: Date;
  excludeId?: string;
}

interface getAppointmentsOnDayReturn {
  start_time: Date;
  end_time: Date;
}

interface CreateAppointmentProps {
  start_time: Date;
  end_time: Date;
  observation?: string;
  client_id: string;
  procedure_id: string;
}

interface BoardRangeProps {
  startDate: Date;
  endDate: Date;
}

interface UpdateAppointmentTimesProps {
  id: string;
  start_time: Date;
  end_time: Date;
  observation?: string;
  procedure_id: string;
}

const appointmentDetails = {
  procedure: {
    select: {
      id: true,
      name: true,
      duration_minutes: true,
      price: true,
    },
  },
  client: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
    },
  },
} as const;

function isOverlapConstraintError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2004" || error.code === "P2034";
  }

  return error instanceof Error && /23P01|exclusion|could not serialize/i.test(error.message);
}

export class AppointmentRepository {
  async getAppointmentsOnDay({
    startDay,
    endDay,
  }: getAppointmentsOnDayProps): Promise<getAppointmentsOnDayReturn[]> {
    const appointments = await prismaClient.appointments.findMany({
      where: {
        status: { not: "CANCELLED" },
        start_time: { lt: endDay },
        end_time: { gt: startDay },
      },
      select: {
        start_time: true,
        end_time: true,
      },
      orderBy: {
        start_time: "asc",
      },
    });
    return appointments;
  }

  async findConflictingAppointment({
    end_time,
    startHour,
    excludeId,
  }: hasConflictProps): Promise<Appointments | null> {
    return await prismaClient.appointments.findFirst({
      where: {
        status: { not: "CANCELLED" },
        start_time: { lt: end_time },
        end_time: { gt: startHour },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  async createAppointment({
    start_time,
    end_time,
    observation,
    client_id,
    procedure_id,
  }: CreateAppointmentProps): Promise<Appointments> {
    try {
      return await prismaClient.$transaction(
        async (tx) => {
          const hasConflict = await tx.appointments.findFirst({
            where: {
              status: { not: "CANCELLED" },
              start_time: { lt: end_time },
              end_time: { gt: start_time },
            },
          });

          if (hasConflict) {
            throw new ConflictError(
              "Erro: Já existe um agendamento neste horário, atualize a página e tente novamente!",
            );
          }

          return tx.appointments.create({
            data: {
              start_time,
              end_time,
              observation,
              client_id,
              procedure_id,
            },
            include: appointmentDetails,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof ConflictError) {
        throw error;
      }
      if (isOverlapConstraintError(error)) {
        throw new ConflictError(
          "Erro: Já existe um agendamento neste horário, atualize a página e tente novamente!",
        );
      }
      throw error;
    }
  }

  async findById(id: string) {
    return prismaClient.appointments.findUnique({
      where: { id },
      include: appointmentDetails,
    });
  }

  async findByClientId(client_id: string) {
    return prismaClient.appointments.findMany({
      where: { client_id },
      include: {
        procedure: {
          select: {
            id: true,
            name: true,
            duration_minutes: true,
            price: true,
          },
        },
      },
      orderBy: { start_time: "desc" },
    });
  }

  async findBoard({ startDate, endDate }: BoardRangeProps) {
    return prismaClient.appointments.findMany({
      where: {
        start_time: { lt: endDate },
        end_time: { gt: startDate },
      },
      include: appointmentDetails,
      orderBy: { start_time: "asc" },
    });
  }

  async cancelAppointment(id: string): Promise<Appointments> {
    return prismaClient.appointments.update({
      where: { id },
      data: { status: "CANCELLED" },
      include: appointmentDetails,
    });
  }

  async updateAppointment({
    id,
    start_time,
    end_time,
    observation,
    procedure_id,
  }: UpdateAppointmentTimesProps) {
    try {
      return await prismaClient.$transaction(
        async (tx) => {
          const hasConflict = await tx.appointments.findFirst({
            where: {
              id: { not: id },
              status: { not: "CANCELLED" },
              start_time: { lt: end_time },
              end_time: { gt: start_time },
            },
          });

          if (hasConflict) {
            throw new ConflictError(
              "Erro: Já existe um agendamento neste horário, atualize a página e tente novamente!",
            );
          }

          return tx.appointments.update({
            where: { id },
            data: {
              start_time,
              end_time,
              observation,
              procedure_id,
              status: "SCHEDULED",
            },
            include: appointmentDetails,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof ConflictError) {
        throw error;
      }
      if (isOverlapConstraintError(error)) {
        throw new ConflictError(
          "Erro: Já existe um agendamento neste horário, atualize a página e tente novamente!",
        );
      }
      throw error;
    }
  }
}
