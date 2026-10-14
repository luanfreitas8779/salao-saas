import { WorkingHoursRepository } from "./workingHours.repository";
import { WorkingHoursService } from "./workingHours.service";
import { WorkingHoursController } from "./workingHours.controller";

export const makeWorkingHoursController = () => {
  const workingHoursRepository = new WorkingHoursRepository();
  const workingHoursService = new WorkingHoursService(workingHoursRepository);
  return new WorkingHoursController(workingHoursService);
};
