import { WorkingHours } from "../../generated/prisma/client";
import { WorkingHoursRepository } from "./workingHours.repository";

interface WorkingDayProps {
  day: number;
  start_time: string;
  end_time: string;
  break_start?: string | null;
  break_end?: string | null;
  isOpen: boolean;
}

export class WorkingHoursService {
  constructor(
    private readonly workingHoursRepository: WorkingHoursRepository,
  ) {}

  async updateWorkingHours(days: WorkingDayProps[]): Promise<WorkingHours[]> {
    const updatedDays =
      await this.workingHoursRepository.updateWorkingHours(days);

    return updatedDays;
  }
}
