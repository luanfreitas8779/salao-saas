import { BadRequestError, NotFoundError } from "../../errors/app-error";
import { AppointmentRepository } from "../appointments/appointment.repository";
import { ScheduleBlocksRepository } from "./scheduleBlocks.repository";
import { businessDateTime, nextBusinessDay } from "../../utils/businessTime";

interface CreateScheduleBlockProps {
  start_time: Date;
  end_time: Date;
  reason?: string;
}

interface UpdateScheduleBlockProps extends CreateScheduleBlockProps {
  id: string;
}

interface ScheduleBlockIdProps {
  id: string;
}

export class ScheduleBlocksService {
  constructor(
    private readonly scheduleBlocksRepository: ScheduleBlocksRepository,
    private readonly appointmentsRepository: AppointmentRepository,
  ) {}

  async createScheduleBlock({
    start_time,
    end_time,
    reason,
  }: CreateScheduleBlockProps) {
    await this.assertPeriodIsFree(start_time, end_time);

    const createdBlock =
      await this.scheduleBlocksRepository.createNewScheduleBlock({
        start_time: start_time,
        end_time: end_time,
        reason: reason,
      });

    return createdBlock;
  }

  async listScheduleBlocks(start_date: string, end_date: string) {
    return this.scheduleBlocksRepository.findScheduleBlocksInPeriod({
      start_time: businessDateTime(start_date),
      end_time: nextBusinessDay(end_date),
    });
  }

  async updateScheduleBlock({
    id,
    start_time,
    end_time,
    reason,
  }: UpdateScheduleBlockProps) {
    await this.ensureScheduleBlockExists(id);
    //o próprio bloqueio não conta como conflito: ele está sendo movido
    await this.assertPeriodIsFree(start_time, end_time, id);

    return this.scheduleBlocksRepository.updateScheduleBlock({
      id,
      start_time,
      end_time,
      reason,
    });
  }

  async deleteScheduleBlock({ id }: ScheduleBlockIdProps) {
    await this.ensureScheduleBlockExists(id);

    return this.scheduleBlocksRepository.deleteScheduleBlock(id);
  }

  //Validação repetida em update e delete, centralizada em um lugar só
  private async ensureScheduleBlockExists(id: string) {
    const existingBlock =
      await this.scheduleBlocksRepository.findScheduleBlockById(id);

    if (!existingBlock) {
      throw new NotFoundError("Bloqueio não encontrado");
    }

    return existingBlock;
  }

  //Um bloqueio não pode cobrir outro bloqueio nem um agendamento existente
  private async assertPeriodIsFree(
    start_time: Date,
    end_time: Date,
    excludeBlockId?: string,
  ) {
    const [conflictingBlocks, conflictingAppointment] = await Promise.all([
      this.scheduleBlocksRepository.findConflictingScheduleBlock({
        start_time: start_time,
        end_time: end_time,
        ...(excludeBlockId ? { excludeId: excludeBlockId } : {}),
      }),
      this.appointmentsRepository.findConflictingAppointment({
        start_time: start_time,
        end_time: end_time,
      }),
    ]);

    if (conflictingBlocks.length > 0 || conflictingAppointment) {
      throw new BadRequestError(
        "Já existe algum bloqueio ou agendamento para a data selecionada.",
      );
    }
  }
}
