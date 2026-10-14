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
    const [hasScheduleBlock, findConflitingAppointments] = await Promise.all([
      this.scheduleBlocksRepository.findConflictingScheduleBlock({
        start_time: start_time,
        end_time: end_time,
      }),
      this.appointmentsRepository.findConflictingAppointment({
        startHour: start_time,
        end_time: end_time,
      }),
    ]);

    if (hasScheduleBlock.length > 0 || findConflitingAppointments) {
      throw new BadRequestError(
        "Já existe algum bloqueio ou agendamento para a data selecionada.",
      );
    }

    const createBlock =
      await this.scheduleBlocksRepository.createNewScheduleBlock({
        start_time: start_time,
        end_time: end_time,
        reason: reason,
      });

    return createBlock;
  }
}
