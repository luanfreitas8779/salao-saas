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
  excludeId?: string;
}

interface FindScheduleBlocksInPeriodProps {
  start_time: Date;
  end_time: Date;
}

interface UpdateScheduleBlockProps {
  id: string;
  start_time: Date;
  end_time: Date;
  reason?: string;
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
    excludeId,
  }: FindConflictingScheduleBlockProps): Promise<Schedule_blocks []> {
    const conflictingBlocks =
      await prismaClient.schedule_blocks.findMany({
        where: {
          start_time: { lt: end_time },
          end_time: { gt: start_time },
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
      });
    return conflictingBlocks;
  }

  async findScheduleBlockById(id: string): Promise<Schedule_blocks | null> {
    return prismaClient.schedule_blocks.findUnique({
      where: { id },
    });
  }

  async findScheduleBlocksInPeriod({
    start_time,
    end_time,
  }: FindScheduleBlocksInPeriodProps): Promise<Schedule_blocks[]> {
    return prismaClient.schedule_blocks.findMany({
      where: {
        start_time: { lt: end_time },
        end_time: { gt: start_time },
      },
      orderBy: { start_time: "asc" },
    });
  }

  async updateScheduleBlock({
    id,
    start_time,
    end_time,
    reason,
  }: UpdateScheduleBlockProps): Promise<Schedule_blocks> {
    return prismaClient.schedule_blocks.update({
      where: { id },
      data: { start_time, end_time, reason },
    });
  }

  async deleteScheduleBlock(id: string): Promise<Schedule_blocks> {
    return prismaClient.schedule_blocks.delete({
      where: { id },
    });
  }
}
