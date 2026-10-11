import { ProcedureRepository } from "../procedures/procedure.repository";
import { ProcedureService } from "./procedure.service";
import { ProcedureController } from "./procedure.controller";

export const makeProcedureController = (): ProcedureController => {
  const procedureRepository = new ProcedureRepository();
  const procedureService = new ProcedureService(procedureRepository);

  return new ProcedureController(procedureService);
}