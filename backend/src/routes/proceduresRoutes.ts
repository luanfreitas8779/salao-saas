import { Router } from "express";
import { isAuthenticated } from "../middlewares/isAuthenticatedMiddleware";
import { makeProcedureController } from "../app/procedures/procedure.factory";
import { validateSchema } from "../middlewares/validateSchema";
import { createProcedureSchema } from "../schemas/procedures/createProcedureSchema";
import { editProcedureSchema } from "../schemas/procedures/editProcedureSchema";
import { deleteProcedureSchema } from "../schemas/procedures/deleteProcedureSchema";
import { isProf } from "../middlewares/isProf";

const routes = Router();
const procedureController = makeProcedureController();

routes.get("/", procedureController.findActiveProcedures);

routes.get(
  "/all",
  isAuthenticated,
  isProf,
  procedureController.findAllProcedures,
);

routes.post(
  "/",
  isAuthenticated,
  isProf,
  validateSchema(createProcedureSchema),
  procedureController.createNewProcedure,
);

routes.put(
  "/:id",
  isAuthenticated,
  isProf,
  validateSchema(editProcedureSchema),
  procedureController.editProcedure,
);

routes.delete(
  "/:id",
  isAuthenticated,
  isProf,
  validateSchema(deleteProcedureSchema),
  procedureController.deleteProcedure,
);

export { routes };
