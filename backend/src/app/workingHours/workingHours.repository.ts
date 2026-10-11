import { WorkingHours } from "../../generated/prisma/client";
import { BatchPayload } from "../../generated/prisma/internal/prismaNamespace";
import prismaClient from "../../prisma";

interface DayDataProps {
  day: number;
  start_time: string;
  end_time: string;
  break_start: string;
  break_end: string;
  isOpen: boolean;
}

export class WorkingHoursRepository {
  async updateWorkingHours(newData: DayDataProps[]): Promise<BatchPayload> {
    const update = await prismaClient.workingHours.updateMany({
      data: newData.map((day) => ({
        dayOfWeek: day.day,
        start_time: day.start_time,
        end_time: day.end_time,
        break_start: day.break_start,
        break_end: day.break_end,
        isOpen: day.isOpen,
      })),
    });

    return update;
  }

  async findWorkingHoursOfDay(dayOfWeek: number): Promise<WorkingHours | null> {
    const isOpen = prismaClient.workingHours.findFirst({
      where: {
        dayOfWeek: dayOfWeek,
      },
    });
    return isOpen;
  }
}
