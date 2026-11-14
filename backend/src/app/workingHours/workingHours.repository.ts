import { WorkingHours } from "../../generated/prisma/client";
import prismaClient from "../../prisma";

interface WorkingDayProps {
  day: number;
  start_time: string;
  end_time: string;
  break_start?: string | null;
  break_end?: string | null;
  isOpen: boolean;
}

export class WorkingHoursRepository {
  async updateWorkingHours(days: WorkingDayProps[]): Promise<WorkingHours[]> {
    //updateMany aplica o mesmo valor a todas as linhas, então cada dia é atualizado
    //separadamente dentro de uma transação (ou atualiza todos, ou nenhum)
    const updatedDays = await prismaClient.$transaction(
      days.map((day) =>
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

    return updatedDays;
  }

  async findWorkingHoursOfDay(dayOfWeek: number): Promise<WorkingHours | null> {
    const workingHours = prismaClient.workingHours.findFirst({
      where: {
        dayOfWeek: dayOfWeek,
      },
    });
    return workingHours;
  }
}
