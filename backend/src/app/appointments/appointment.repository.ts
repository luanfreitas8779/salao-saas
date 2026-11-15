import prismaClient from "../../prisma";
import { Appointments } from "../../generated/prisma/client";
import { ConflictError } from "../../errors/app-error";

interface GetAppointmentsOnDayProps {
  startDay: Date;
  endDay: Date;
}

interface FindConflictingAppointmentProps {
  start_time: Date;
  end_time: Date;
  excludeId?: string;
}

interface AppointmentPeriod {
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

interface UpdateAppointmentProps {
  id: string;
  start_time: Date;
  end_time: Date;
  observation?: string;
  procedure_id: string;
}

const appointmentRelations = {
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

const OVERLAP_MESSAGE =
  "Erro: Já existe um agendamento neste horário, atualize a página e tente novamente!";

//Quem impede dois agendamentos no mesmo horário é o banco, com a constraint
//appointments_no_overlap (ver a migration 20261010195200). Ela é conferida
//dentro do próprio INSERT/UPDATE, de forma atômica: de duas requisições
//simultâneas, uma grava e a outra recebe o erro 23P01 (exclusion_violation).
//Com o @prisma/adapter-pg, o código do Postgres chega em error.cause.code.
//Não usamos a mensagem: ela muda com o idioma configurado no Postgres.
function isOverlapConstraintError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const { cause } = error as Error & { cause?: { code?: unknown } };
  return cause?.code === "23P01";
}

export class AppointmentRepository {
  async getAppointmentsOnDay({
    startDay,
    endDay,
  }: GetAppointmentsOnDayProps): Promise<AppointmentPeriod[]> {
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
    start_time,
    end_time,
    excludeId,
  }: FindConflictingAppointmentProps): Promise<Appointments | null> {
    return await prismaClient.appointments.findFirst({
      where: {
        status: { not: "CANCELLED" },
        start_time: { lt: end_time },
        end_time: { gt: start_time },
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
      return await prismaClient.appointments.create({
        data: {
          start_time,
          end_time,
          observation,
          client_id,
          procedure_id,
        },
        include: appointmentRelations,
      });
    } catch (error) {
      if (isOverlapConstraintError(error)) {
        throw new ConflictError(OVERLAP_MESSAGE);
      }
      throw error;
    }
  }

  async findById(id: string) {
    return prismaClient.appointments.findUnique({
      where: { id },
      include: appointmentRelations,
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
      include: appointmentRelations,
      orderBy: { start_time: "asc" },
    });
  }

  async cancelAppointment(id: string): Promise<Appointments> {
    return prismaClient.appointments.update({
      where: { id },
      data: { status: "CANCELLED" },
      include: appointmentRelations,
    });
  }

  async updateAppointment({
    id,
    start_time,
    end_time,
    observation,
    procedure_id,
  }: UpdateAppointmentProps) {
    try {
      return await prismaClient.appointments.update({
        where: { id },
        data: {
          start_time,
          end_time,
          observation,
          procedure_id,
          status: "SCHEDULED",
        },
        include: appointmentRelations,
      });
    } catch (error) {
      if (isOverlapConstraintError(error)) {
        throw new ConflictError(OVERLAP_MESSAGE);
      }
      throw error;
    }
  }
}
