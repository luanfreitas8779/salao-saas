import { Request, Response } from "express";
import { EditProcedureService } from "../../services/procedures/EditProcedureService";
export class EditProceduresController {
  async handle(req: Request, res: Response) {
    const { id, name, description, price, duration_minutes } = req.body;

    const service = new EditProcedureService();

    const result = await service.execute({
      id: id,
      name: name,
      description: description,
      price: price,
      duration_minutes: duration_minutes,
    });

    res.json(result);
  }
}
