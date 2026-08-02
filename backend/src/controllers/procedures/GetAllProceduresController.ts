import { GetAllProceduresService } from "../../services/procedures/GetAllProceduresService";
import { Request, Response } from "express";

export class GetAllProceduresController {
  async handle(req: Request, res: Response) {
    const service = new GetAllProceduresService();

    const result = await service.execute();

    res.json(result);
  }
}
