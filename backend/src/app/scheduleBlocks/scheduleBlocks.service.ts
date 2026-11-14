import { BadRequestError } from "../../errors/app-error";
import { AppointmentRepository } from "../appointments/appointment.repository";
import { ScheduleBlocksRepository } from "./scheduleBlocks.repository";

interface CreateScheduleBlockProps {
  start_time: Date;
  end_time: Date;
  reason?: string;
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
    const [conflictingBlocks, conflictingAppointment] = await Promise.all([
      this.scheduleBlocksRepository.findConflictingScheduleBlock({
        start_time: start_time,
        end_time: end_time,
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

    const createdBlock =
      await this.scheduleBlocksRepository.createNewScheduleBlock({
        start_time: start_time,
        end_time: end_time,
        reason: reason,
      });

    return createdBlock;
  }
}
