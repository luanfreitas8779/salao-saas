import prismaClient from "../../prisma";

interface CreateScheduleBlockProps {
  start_time: Date;
  end_time: Date;
  reason?: string;
}
export class CreateScheduleBlockService {
  async execute({ start_time, end_time, reason }: CreateScheduleBlockProps) {
    const blockExists = await prismaClient.schedule_blocks.findFirst({
      where: {
        start_time: { lt: end_time },
        end_time: { gt: start_time },
      },
    });

    if (blockExists) {
      throw new Error("Já existe um bloqueio para a data selecionada!");
    }

    const createBlcok = await prismaClient.schedule_blocks.create({
      data: {
        start_time: start_time,
        end_time: end_time,
        reason: reason,
      },
    });

    return createBlcok;
  }
}
