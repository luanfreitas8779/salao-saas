import { WorkingHours } from "../../generated/prisma/client";
import prismaClient from "../../prisma";

interface DayDataProps {
  day: number;
  start_time: string;
  end_time: string;
  break_start?: string | null;
  break_end?: string | null;
  isOpen: boolean;
}

export class WorkingHoursRepository {
  async updateWorkingHours(newData: DayDataProps[]): Promise<WorkingHours[]> {
    //updateMany aplica o mesmo valor a todas as linhas, então cada dia é atualizado
    //separadamente dentro de uma transação (ou atualiza todos, ou nenhum)
    const update = await prismaClient.$transaction(
      newData.map((day) =>
        prismaClient.workingHours.update({
          where: { dayOfWeek: day.day },
          data: {
            start_time: day.start_time,
            end_time: day.end_time,
            break_start: day.break_start ?? null,
            break_end: day.break_end ?? null,
            isOpen: day.isOpen,
          },
        }),
      ),
    );

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
