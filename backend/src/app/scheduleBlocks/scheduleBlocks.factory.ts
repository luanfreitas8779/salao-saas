import { ScheduleBlocksController } from "./scheduleBlocks.controller";
import { ScheduleBlocksRepository } from "./scheduleBlocks.repository";
import { ScheduleBlocksService } from "./scheduleBlocks.service";
import { AppointmentRepository } from "../appointments/appointment.repository";

export const makeScheduleBlocksController = (): ScheduleBlocksController => {
  const appointmentRepository = new AppointmentRepository();
  const scheduleBlocksRepository = new ScheduleBlocksRepository();
  const scheduleBlocksService = new ScheduleBlocksService(scheduleBlocksRepository, appointmentRepository);

    return new ScheduleBlocksController(scheduleBlocksService);
}