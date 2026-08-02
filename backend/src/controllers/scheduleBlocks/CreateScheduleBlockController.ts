import { CreateScheduleBlockService } from "../../services/scheduleBlocks/CreateScheduleBlockService";
import { Request, Response } from "express";

export class CreateScheduleBlockController {
  async handle(req: Request, res: Response) {
    const { start_time, end_time, reason } = req.body;

    const service = new CreateScheduleBlockService();

    const result = await service.execute({
      start_time: start_time,
      end_time: end_time,
      reason: reason,
    });

    res.json(result);
  }
}
