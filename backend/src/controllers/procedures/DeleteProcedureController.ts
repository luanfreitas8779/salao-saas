import { DeleteProcedureService } from "../../services/procedures/DeleteProcedureService";
import { Request, Response } from "express";

export class DeleteProcedureController {
  async handle(req: Request, res: Response) {
    const { id } = req.params;
    const idString = `${id}`;

    const service = new DeleteProcedureService();

    const result = await service.execute({ id: idString });

    res.json(result);
  }
}
