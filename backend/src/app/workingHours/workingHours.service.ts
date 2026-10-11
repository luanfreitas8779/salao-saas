import { BatchPayload } from "../../generated/prisma/internal/prismaNamespace";
import { WorkingHoursRepository } from "./workingHours.repository";

interface DayDataProps {
  day: number;
  start_time: string;
  end_time: string;
  break_start: string;
  break_end: string;
  isOpen: boolean;
}

export class WorkingHoursService {
  constructor(
    private readonly workingHoursRepository: WorkingHoursRepository,
  ) {}

  async updateWorkingHours(newData: DayDataProps[]): Promise<BatchPayload> {
    const update =
      await this.workingHoursRepository.updateWorkingHours(newData);

    return update;
  }
}
