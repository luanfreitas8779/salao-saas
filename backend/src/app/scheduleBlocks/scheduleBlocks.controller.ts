import { ScheduleBlocksService } from "./scheduleBlocks.service";
import { Request, Response } from "express";

export class ScheduleBlocksController {
  constructor(private readonly service: ScheduleBlocksService) {}

  async createScheduleBlock(req: Request, res: Response) {
    const { start_time, end_time, reason } = req.body;

    const result = await this.service.createScheduleBlock({
      start_time: start_time,
      end_time: end_time,
      reason: reason,
    });

    res.status(201).json({ result });
  }
}
