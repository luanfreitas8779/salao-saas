import { CreateNewProcedureService } from "../../services/procedures/CreateNewProcedureService";
import { Request, Response } from "express";

export class CreateNewProcedureController {
  async handle(req: Request, res: Response) {
    const { name, description, price, duration_minutes } = req.body;

    const service = new CreateNewProcedureService();

    const result = await service.execute({
      name: name,
      description: description,
      price: price,
      duration_time: duration_minutes,
    });

    res.json(result);
  }
}
