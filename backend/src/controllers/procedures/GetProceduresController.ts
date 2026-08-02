import { GetProceduresService } from "../../services/procedures/GetProceduresService";
import { Response, Request } from "express";

export class GetProceduresController {
  async handle(_: Request, res: Response) {
    const proceduresService = new GetProceduresService();

    const procedures = await proceduresService.execute();

    res.json(procedures);
  }
}
