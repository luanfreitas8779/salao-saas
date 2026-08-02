import prismaClient from "../../prisma";

interface DayDataProps {
  day: number;
  start_time: string;
  end_time: string;
  break_start: string;
  break_end: string;
  isOpen: boolean;
}

interface WorkingHoursProps {
  newData: DayDataProps[];
}

export class UpdateWorkingHoursService {
  async execute({ newData }: WorkingHoursProps) {
    const result = await prismaClient.workingHours.updateMany({
      data: newData.map((day) => ({
        dayOfWeek: day.day,
        start_time: day.start_time,
        end_time: day.end_time,
        break_start: day.break_start,
        break_end: day.break_end,
        isOpen: day.isOpen,
      })),
    });

    return result;
  }
}
