import { ScheduleBlocksService } from "./scheduleBlocks.service";
import { Request, Response } from "express";

export class ScheduleBlocksController {
  constructor(private readonly service: ScheduleBlocksService) {}

  createScheduleBlock = async (req: Request, res: Response) => {
    const { start_time, end_time, reason } = req.body;

    const createdBlock = await this.service.createScheduleBlock({
      start_time: new Date(start_time),
      end_time: new Date(end_time),
      reason: reason,
    });

    res.status(201).json(createdBlock);
  };

  listScheduleBlocks = async (req: Request, res: Response) => {
    const { start_date, end_date } = req.query as {
      start_date: string;
      end_date: string;
    };

    const blocks = await this.service.listScheduleBlocks(start_date, end_date);

    res.status(200).json(blocks);
  };

  updateScheduleBlock = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { start_time, end_time, reason } = req.body;

    const updatedBlock = await this.service.updateScheduleBlock({
      id: id,
      start_time: new Date(start_time),
      end_time: new Date(end_time),
      reason: reason,
    });

    res.status(200).json(updatedBlock);
  };

  deleteScheduleBlock = async (req: Request, res: Response) => {
    const id = req.params.id as string;

    const deletedBlock = await this.service.deleteScheduleBlock({ id: id });

    res.status(200).json(deletedBlock);
  };
}
