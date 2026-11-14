import { ProcedureRepository } from "./procedure.repository";
import { ProcedureService } from "./procedure.service";
import { ProcedureController } from "./procedure.controller";

//Único lugar que conhece o repository real (Prisma).
//Trocar o banco = trocar a classe aqui, sem mexer no service.
export const makeProcedureController = (): ProcedureController => {
  const procedureRepository = new ProcedureRepository();
  const procedureService = new ProcedureService(procedureRepository);

  return new ProcedureController(procedureService);
};
