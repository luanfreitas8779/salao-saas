import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "../../errors/app-error";
import { Appointments } from "../../generated/prisma/client";
import { ProcedureRepository } from "../procedures/procedure.repository";
import { ScheduleBlocksRepository } from "../scheduleBlocks/scheduleBlocks.repository";
import { UserRepository } from "../user/user.repository";
import { WorkingHoursRepository } from "../workingHours/workingHours.repository";
import { AppointmentRepository } from "./appointment.repository";
import { addHours, addMinutes, isBefore, parse, format } from "date-fns";

const CANCEL_MIN_HOURS = 24;

interface AppointmentAvailabilityProps {
  procedure_id: string;
  date: string;
}

interface CreateAppointmentProps {
  start_time: string;
  observation?: string;
  actor_id: string;
  actor_role?: string;
  procedure_id: string;
  client_id?: string;
}

interface MutationActorProps {
  appointmentId: string;
  actor_id: string;
  actor_role?: string;
}

interface UpdateAppointmentProps extends MutationActorProps {
  start_time?: string;
  procedure_id?: string;
  observation?: string;
}

function isAdmin(role?: string) {
  return role === "ADMIN";
}

function assertMinLeadTime(startTime: Date) {
  if (isBefore(startTime, addHours(new Date(), CANCEL_MIN_HOURS))) {
    throw new BadRequestError(
      `Cancelamento e edição só são permitidos com no mínimo ${CANCEL_MIN_HOURS} horas de antecedência.`,
    );
  }
}

export class AppointmentService {
  constructor(
    private readonly appointmentRepository: AppointmentRepository,
    private readonly ProcedureRepository: ProcedureRepository,
    private readonly scheduleBlocksRepository: ScheduleBlocksRepository,
    private readonly workingHoursRepository: WorkingHoursRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async availableTimes({ procedure_id, date }: AppointmentAvailabilityProps) {
    const procedure = await this.ProcedureRepository.findProcedureById({
      id: procedure_id,
    });

    if (!procedure || !procedure.is_active) {
      throw new NotFoundError("Procedimento não encontrado");
    }

    const duration_time = procedure.duration_minutes;
    const startDay = parse("00:00", "HH:mm", new Date(date));
    const endDay = parse("23:59:59", "HH:mm:ss", new Date(date));
    const dayNow = new Date(date);
    const dayOfWeek = dayNow.getUTCDay();

    const workingHours =
      await this.workingHoursRepository.findWorkingHoursOfDay(dayOfWeek);

    if (!workingHours || !workingHours.isOpen) {
      throw new BadRequestError(
        "Falha ao buscar horários disponíveis, tente novamente mais tarde!",
      );
    }

    const openHour = parse(workingHours.start_time, "HH:mm", new Date(date));
    const closeHour = parse(workingHours.end_time, "HH:mm", new Date(date));

    const [getBlocksOnDay, appointmentsOnDay] = await Promise.all([
      this.scheduleBlocksRepository.findConflictingScheduleBlock({
        start_time: startDay,
        end_time: endDay,
      }),
      this.appointmentRepository.getAppointmentsOnDay({
        startDay: startDay,
        endDay: endDay,
      }),
    ]);

    let blocksOnDay = [...appointmentsOnDay, ...getBlocksOnDay];

    if (workingHours.break_start && workingHours.break_end) {
      const startBreak = parse(
        workingHours.break_start,
        "HH:mm",
        new Date(date),
      );
      const endBreak = parse(workingHours.break_end, "HH:mm", new Date(date));
      blocksOnDay.push({
        start_time: startBreak,
        end_time: endBreak,
      });
    }
    blocksOnDay.sort((a, b) => +a.start_time - +b.start_time);

    const possibleHours = [];
    let startHourCompare = openHour;
    let finishHourCompare = addMinutes(startHourCompare, duration_time);

    while (finishHourCompare <= closeHour) {
      const isBlocked = blocksOnDay.some((block) => {
        return (
          startHourCompare < block.end_time &&
          finishHourCompare > block.start_time
        );
      });

      if (!isBlocked) {
        possibleHours.push(format(startHourCompare, "HH:mm"));
      }

      startHourCompare = addMinutes(startHourCompare, 30);
      finishHourCompare = addMinutes(finishHourCompare, 30);
    }

    return possibleHours;
  }

  private async resolveActorRole(actor_id: string, actor_role?: string) {
    if (actor_role) {
      return actor_role;
    }

    const actor = await this.userRepository.findUserById({ id: actor_id });
    return actor?.role;
  }

  async createAppointment({
    start_time,
    observation,
    actor_id,
    actor_role,
    procedure_id,
    client_id,
  }: CreateAppointmentProps): Promise<Appointments | null> {
    actor_role = await this.resolveActorRole(actor_id, actor_role);

    const procedure = await this.ProcedureRepository.findProcedureById({
      id: procedure_id,
    });

    if (!procedure || !procedure.is_active) {
      throw new NotFoundError("Procedimento não encontrado");
    }

    let resolvedClientId = actor_id;
    if (client_id && client_id !== actor_id) {
      if (!isAdmin(actor_role)) {
        throw new UnauthorizedError(
          "Sem permissão para agendar em nome de outro cliente",
        );
      }
      const client = await this.userRepository.findUserById({ id: client_id });
      if (!client) {
        throw new NotFoundError("Cliente não encontrado");
      }
      resolvedClientId = client_id;
    }

    const startHour = new Date(start_time);
    const end_time = addMinutes(startHour, procedure.duration_minutes);

    const hasBlock =
      await this.scheduleBlocksRepository.findConflictingScheduleBlock({
        start_time: startHour,
        end_time: end_time,
      });

    if (hasBlock.length > 0) {
      throw new BadRequestError(
        "Esta data não está disponível para agendamentos.",
      );
    }

    return this.appointmentRepository.createAppointment({
      start_time: startHour,
      end_time: end_time,
      observation: observation,
      client_id: resolvedClientId,
      procedure_id: procedure_id,
    });
  }

  async listMine(client_id: string) {
    return this.appointmentRepository.findByClientId(client_id);
  }

  async listBoard(start_date: string, end_date: string) {
    const startDate = parse("00:00", "HH:mm", new Date(start_date));
    const endDate = parse("23:59:59", "HH:mm:ss", new Date(end_date));
    return this.appointmentRepository.findBoard({ startDate, endDate });
  }

  async cancelAppointment({
    appointmentId,
    actor_id,
    actor_role,
  }: MutationActorProps) {
    actor_role = await this.resolveActorRole(actor_id, actor_role);

    const appointment =
      await this.appointmentRepository.findById(appointmentId);

    if (!appointment) {
      throw new NotFoundError("Agendamento não encontrado");
    }

    if (appointment.status === "CANCELLED") {
      throw new BadRequestError("Este agendamento já está cancelado");
    }

    const admin = isAdmin(actor_role);
    if (!admin && appointment.client_id !== actor_id) {
      throw new ForbiddenError(
        "Você não pode cancelar o agendamento de outro cliente",
      );
    }

    if (!admin) {
      assertMinLeadTime(appointment.start_time);
    }

    return this.appointmentRepository.cancelAppointment(appointmentId);
  }

  async updateAppointment({
    appointmentId,
    actor_id,
    actor_role,
    start_time,
    procedure_id,
    observation,
  }: UpdateAppointmentProps) {
    const appointment =
      await this.appointmentRepository.findById(appointmentId);

    if (!appointment) {
      throw new NotFoundError("Agendamento não encontrado");
    }

    if (appointment.status === "CANCELLED") {
      throw new BadRequestError("Não é possível editar um agendamento cancelado");
    }

    const admin = isAdmin(actor_role);
    if (!admin && appointment.client_id !== actor_id) {
      throw new ForbiddenError(
        "Você não pode editar o agendamento de outro cliente",
      );
    }

    if (!admin) {
      assertMinLeadTime(appointment.start_time);
    }

    const nextProcedureId = procedure_id ?? appointment.procedure_id;
    const procedure = await this.ProcedureRepository.findProcedureById({
      id: nextProcedureId,
    });

    if (!procedure || !procedure.is_active) {
      throw new NotFoundError("Procedimento não encontrado");
    }

    const nextStart = start_time
      ? new Date(start_time)
      : appointment.start_time;
    const nextEnd = addMinutes(nextStart, procedure.duration_minutes);

    if (!admin && start_time) {
      assertMinLeadTime(nextStart);
    }

    const hasBlock =
      await this.scheduleBlocksRepository.findConflictingScheduleBlock({
        start_time: nextStart,
        end_time: nextEnd,
      });

    if (hasBlock.length > 0) {
      throw new BadRequestError(
        "Esta data não está disponível para agendamentos.",
      );
    }

    return this.appointmentRepository.updateAppointment({
      id: appointmentId,
      start_time: nextStart,
      end_time: nextEnd,
      observation:
        observation !== undefined ? observation : appointment.observation ?? undefined,
      procedure_id: nextProcedureId,
    });
  }
}
