import { WorkingHours } from "../../generated/prisma/client";
import { WorkingHoursRepository } from "./workingHours.repository";

interface DayDataProps {
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

  async updateWorkingHours(newData: DayDataProps[]): Promise<WorkingHours[]> {
    const update =
      await this.workingHoursRepository.updateWorkingHours(newData);

    return update;
  }
}
