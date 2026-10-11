import { Request, Response } from "express";
import { WorkingHoursService } from "./workingHours.service";

export class WorkingHoursController {
  constructor(private readonly service: WorkingHoursService) {}
  handle = async (req: Request, res: Response) => {
    const { newData } = req.body;

    const result = await this.service.updateWorkingHours(newData);

    res.json(result);
  };
}