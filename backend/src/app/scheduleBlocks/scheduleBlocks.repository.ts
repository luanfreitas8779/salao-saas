import { Schedule_blocks } from "../../generated/prisma/client";
import prismaClient from "../../prisma";

interface CreateScheduleBlockProps {
  start_time: Date;
  end_time: Date;
  reason?: string;
}

interface FindConflictingScheduleBlockProps {
  start_time: Date;
  end_time: Date;
}

export class ScheduleBlocksRepository {
  async createNewScheduleBlock({
    start_time,
    end_time,
    reason,
  }: CreateScheduleBlockProps): Promise<Schedule_blocks> {
    const createdBlock = await prismaClient.schedule_blocks.create({
      data: {
        start_time: start_time,
        end_time: end_time,
        reason: reason,
      },
    });
    return createdBlock;
  }

  async findConflictingScheduleBlock({
    start_time,
    end_time,
  }: FindConflictingScheduleBlockProps): Promise<Schedule_blocks []> {
    const conflictingBlocks =
      await prismaClient.schedule_blocks.findMany({
        where: {
          start_time: { lt: end_time },
          end_time: { gt: start_time },
        },
      });
    return conflictingBlocks;
  }
}
