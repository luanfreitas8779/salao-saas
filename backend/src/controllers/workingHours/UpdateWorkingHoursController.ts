import { UpdateWorkingHoursService } from "../../services/workingHours/UpdateWorkingHoursService";
import { Request, Response } from "express";

export class UpdateWorkingHoursController {
  async handle(req: Request, res: Response) {
    const { newData } = req.body;

    const service = new UpdateWorkingHoursService();

    const result = service.execute({ newData: newData });

    res.json(result);
  }
}
