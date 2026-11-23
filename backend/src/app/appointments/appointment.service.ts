import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "../../errors/app-error";
import { Appointments } from "../../generated/prisma/client";
import { ProcedureRepository } from "../procedures/procedure.repository";
import { ScheduleBlocksRepository } from "../scheduleBlocks/scheduleBlocks.repository";
import { UserRepository } from "../user/user.repository";
import { WorkingHoursRepository } from "../workingHours/workingHours.repository";
import { AppointmentRepository } from "./appointment.repository";
import { addHours, addMinutes, isBefore } from "date-fns";
import {
  SLOT_STEP_MINUTES,
  businessDateTime,
  businessDayOfWeek,
  fromMinutes,
  nextBusinessDay,
  toBusinessWallClock,
  toMinutes,
} from "../../utils/businessTime";

const MIN_LEAD_TIME_HOURS = 24;

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

interface AppointmentActorProps {
  appointmentId: string;
  actor_id: string;
  actor_role?: string;
}

interface PageProps {
  page: number;
  limit: number;
}

interface AppointmentIdProps {
  appointmentId: string;
}

interface UpdateAppointmentProps extends AppointmentActorProps {
  start_time?: string;
  procedure_id?: string;
  observation?: string;
}

function isProfRole(role?: string) {
  return role === "PROF";
}

function assertMinLeadTime(startTime: Date) {
  if (isBefore(startTime, addHours(new Date(), MIN_LEAD_TIME_HOURS))) {
    throw new BadRequestError(
      `Cancelamento e edição só são permitidos com no mínimo ${MIN_LEAD_TIME_HOURS} horas de antecedência.`,
    );
  }
}

export class AppointmentService {
  constructor(
    private readonly appointmentRepository: AppointmentRepository,
    private readonly procedureRepository: ProcedureRepository,
    private readonly scheduleBlocksRepository: ScheduleBlocksRepository,
    private readonly workingHoursRepository: WorkingHoursRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async availableTimes({ procedure_id, date }: AppointmentAvailabilityProps) {
    const procedure = await this.procedureRepository.findProcedureById({
      id: procedure_id,
    });

    if (!procedure || !procedure.is_active) {
      throw new NotFoundError("Procedimento não encontrado");
    }

    const durationMinutes = procedure.duration_minutes;
    const startDay = businessDateTime(date);
    const endDay = nextBusinessDay(date);
    const dayOfWeek = businessDayOfWeek(date);

    const workingHours =
      await this.workingHoursRepository.findWorkingHoursOfDay(dayOfWeek);

    if (!workingHours || !workingHours.isOpen) {
      throw new BadRequestError(
        "Falha ao buscar horários disponíveis, tente novamente mais tarde!",
      );
    }

    const openMinutes = toMinutes(workingHours.start_time);
    const closeMinutes = toMinutes(workingHours.end_time);

    const [scheduleBlocksOnDay, appointmentsOnDay] = await Promise.all([
      this.scheduleBlocksRepository.findConflictingScheduleBlock({
        start_time: startDay,
        end_time: endDay,
      }),
      this.appointmentRepository.getAppointmentsOnDay({
        startDay: startDay,
        endDay: endDay,
      }),
    ]);

    const busyPeriods = [...appointmentsOnDay, ...scheduleBlocksOnDay];

    if (workingHours.break_start && workingHours.break_end) {
      busyPeriods.push({
        start_time: businessDateTime(date, workingHours.break_start),
        end_time: businessDateTime(date, workingHours.break_end),
      });
    }

    const now = new Date();
    const availableSlots: string[] = [];

    for (
      let slotStart = openMinutes;
      slotStart + durationMinutes <= closeMinutes;
      slotStart += SLOT_STEP_MINUTES
    ) {
      const slotStartTime = businessDateTime(date, fromMinutes(slotStart));
      const slotEndTime = addMinutes(slotStartTime, durationMinutes);

      const isPast = slotStartTime <= now;
      const isBlocked = busyPeriods.some(
        (block) =>
          slotStartTime < block.end_time && slotEndTime > block.start_time,
      );

      if (!isPast && !isBlocked) {
        availableSlots.push(fromMinutes(slotStart));
      }
    }

    return availableSlots;
  }

  // Garante que o intervalo [start, end] respeita as regras do salão:
  // futuro, dia aberto, dentro do expediente, fora da pausa e na grade de horários
  private async assertWithinBusinessRules(start: Date, end: Date) {
    if (start <= new Date()) {
      throw new BadRequestError(
        "Não é possível agendar em um horário que já passou.",
      );
    }

    const { date: startDate, minutes: startMinutes } = toBusinessWallClock(start);
    const { date: endDate, minutes: endMinutes } = toBusinessWallClock(end);

    const workingHours = await this.workingHoursRepository.findWorkingHoursOfDay(
      businessDayOfWeek(startDate),
    );

    if (!workingHours || !workingHours.isOpen) {
      throw new BadRequestError("O salão não funciona neste dia.");
    }

    const openMinutes = toMinutes(workingHours.start_time);
    const closeMinutes = toMinutes(workingHours.end_time);

    if (
      endDate !== startDate ||
      startMinutes < openMinutes ||
      endMinutes > closeMinutes
    ) {
      throw new BadRequestError("Horário fora do expediente do salão.");
    }

    if ((startMinutes - openMinutes) % SLOT_STEP_MINUTES !== 0) {
      throw new BadRequestError(
        `Horário inválido. Os horários seguem intervalos de ${SLOT_STEP_MINUTES} minutos a partir da abertura.`,
      );
    }

    if (workingHours.break_start && workingHours.break_end) {
      const breakStart = toMinutes(workingHours.break_start);
      const breakEnd = toMinutes(workingHours.break_end);

      if (startMinutes < breakEnd && endMinutes > breakStart) {
        throw new BadRequestError("Horário conflita com a pausa do salão.");
      }
    }
  }

  //Validação repetida em cancelar, editar e concluir, centralizada em um lugar só
  private async findAppointmentOrFail(appointmentId: string) {
    const appointment =
      await this.appointmentRepository.findById(appointmentId);

    if (!appointment) {
      throw new NotFoundError("Agendamento não encontrado");
    }

    return appointment;
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

    const procedure = await this.procedureRepository.findProcedureById({
      id: procedure_id,
    });

    if (!procedure || !procedure.is_active) {
      throw new NotFoundError("Procedimento não encontrado");
    }

    let resolvedClientId = actor_id;
    if (client_id && client_id !== actor_id) {
      if (!isProfRole(actor_role)) {
        throw new ForbiddenError(
          "Sem permissão para agendar em nome de outro cliente",
        );
      }
      const client = await this.userRepository.findUserById({ id: client_id });
      if (!client) {
        throw new NotFoundError("Cliente não encontrado");
      }
      resolvedClientId = client_id;
    }

    const startTime = new Date(start_time);
    const endTime = addMinutes(startTime, procedure.duration_minutes);

    await this.assertWithinBusinessRules(startTime, endTime);

    const conflictingBlocks =
      await this.scheduleBlocksRepository.findConflictingScheduleBlock({
        start_time: startTime,
        end_time: endTime,
      });

    if (conflictingBlocks.length > 0) {
      throw new BadRequestError(
        "Esta data não está disponível para agendamentos.",
      );
    }

    return this.appointmentRepository.createAppointment({
      start_time: startTime,
      end_time: endTime,
      observation: observation,
      client_id: resolvedClientId,
      procedure_id: procedure_id,
    });
  }

  //Paginação por offset: a página 3 de 20 em 20 pula os 40 primeiros
  async listMine(client_id: string, { page, limit }: PageProps) {
    return this.appointmentRepository.findByClientId(client_id, {
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async listBoard(start_date: string, end_date: string) {
    const startDate = businessDateTime(start_date);
    const endDate = nextBusinessDay(end_date);
    return this.appointmentRepository.findBoard({ startDate, endDate });
  }

  async cancelAppointment({
    appointmentId,
    actor_id,
    actor_role,
  }: AppointmentActorProps) {
    actor_role = await this.resolveActorRole(actor_id, actor_role);

    const appointment = await this.findAppointmentOrFail(appointmentId);

    if (appointment.status === "CANCELLED") {
      throw new BadRequestError("Este agendamento já está cancelado");
    }

    if (appointment.status === "COMPLETED") {
      throw new BadRequestError("Não é possível cancelar um agendamento concluído");
    }

    const actorIsProf = isProfRole(actor_role);
    if (!actorIsProf && appointment.client_id !== actor_id) {
      throw new ForbiddenError(
        "Você não pode cancelar o agendamento de outro cliente",
      );
    }

    if (!actorIsProf) {
      assertMinLeadTime(appointment.start_time);
    }

    return this.appointmentRepository.cancelAppointment(appointmentId);
  }

  //Marca como atendido. Só o profissional (PROF) chega aqui (a rota usa o isProf).
  async completeAppointment({ appointmentId }: AppointmentIdProps) {
    const appointment = await this.findAppointmentOrFail(appointmentId);

    if (appointment.status === "CANCELLED") {
      throw new BadRequestError("Não é possível concluir um agendamento cancelado");
    }

    if (appointment.status === "COMPLETED") {
      throw new BadRequestError("Este agendamento já foi concluído");
    }

    if (appointment.start_time > new Date()) {
      throw new BadRequestError("Só é possível concluir um agendamento que já começou");
    }

    return this.appointmentRepository.completeAppointment(appointmentId);
  }

  async updateAppointment({
    appointmentId,
    actor_id,
    actor_role,
    start_time,
    procedure_id,
    observation,
  }: UpdateAppointmentProps) {
    actor_role = await this.resolveActorRole(actor_id, actor_role);

    const appointment = await this.findAppointmentOrFail(appointmentId);

    if (appointment.status === "CANCELLED") {
      throw new BadRequestError("Não é possível editar um agendamento cancelado");
    }

    if (appointment.status === "COMPLETED") {
      throw new BadRequestError("Não é possível editar um agendamento concluído");
    }

    const actorIsProf = isProfRole(actor_role);
    if (!actorIsProf && appointment.client_id !== actor_id) {
      throw new ForbiddenError(
        "Você não pode editar o agendamento de outro cliente",
      );
    }

    if (!actorIsProf) {
      assertMinLeadTime(appointment.start_time);
    }

    const procedureId = procedure_id ?? appointment.procedure_id;
    const procedure = await this.procedureRepository.findProcedureById({
      id: procedureId,
    });

    if (!procedure || !procedure.is_active) {
      throw new NotFoundError("Procedimento não encontrado");
    }

    const newStartTime = start_time
      ? new Date(start_time)
      : appointment.start_time;
    const newEndTime = addMinutes(newStartTime, procedure.duration_minutes);

    if (!actorIsProf && start_time) {
      assertMinLeadTime(newStartTime);
    }

    if (start_time || procedure_id) {
      await this.assertWithinBusinessRules(newStartTime, newEndTime);
    }

    const conflictingBlocks =
      await this.scheduleBlocksRepository.findConflictingScheduleBlock({
        start_time: newStartTime,
        end_time: newEndTime,
      });

    if (conflictingBlocks.length > 0) {
      throw new BadRequestError(
        "Esta data não está disponível para agendamentos.",
      );
    }

    return this.appointmentRepository.updateAppointment({
      id: appointmentId,
      start_time: newStartTime,
      end_time: newEndTime,
      observation:
        observation !== undefined ? observation : appointment.observation ?? undefined,
      procedure_id: procedureId,
    });
  }
}
