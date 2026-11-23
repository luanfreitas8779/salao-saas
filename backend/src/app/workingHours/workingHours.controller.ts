import { Request, Response } from "express";
import { WorkingHoursService } from "./workingHours.service";

export class WorkingHoursController {
  constructor(private readonly service: WorkingHoursService) {}
  listWorkingHours = async (_: Request, res: Response) => {
    const days = await this.service.listWorkingHours();

    res.status(200).json(days);
  };

  updateWorkingHours = async (req: Request, res: Response) => {
    const { newData } = req.body;

    const updatedDays = await this.service.updateWorkingHours(newData);

    res.status(200).json(updatedDays);
  };
}