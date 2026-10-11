import { AppointmentRepository } from "./appointment.repository";
import { ProcedureRepository } from "../procedures/procedure.repository";
import { ScheduleBlocksRepository } from "../scheduleBlocks/scheduleBlocks.repository";
import { WorkingHoursRepository } from "../workingHours/workingHours.repository";
import { UserRepository } from "../user/user.repository";
import { AppointmentService } from "./appointment.service";
import { AppointmentController } from "./appointment.controller";

export const makeAppointmentController = (): AppointmentController => {
  const appointmentRepository = new AppointmentRepository();
  const procedureRepository = new ProcedureRepository();
  const scheduleBlocksRepository = new ScheduleBlocksRepository();
  const workingHoursRepository = new WorkingHoursRepository();
  const userRepository = new UserRepository();

  const appointmentService = new AppointmentService(
    appointmentRepository,
    procedureRepository,
    scheduleBlocksRepository,
    workingHoursRepository,
    userRepository,
  );

  return new AppointmentController(appointmentService);
};
