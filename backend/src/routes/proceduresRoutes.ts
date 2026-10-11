import { Router } from "express";
import { isAuthenticated } from "../middlewares/isAuthenticatedMiddleware";
import { makeProcedureController } from "../app/procedures/procedure.factory";
import { validateSchema } from "../middlewares/validateSchema";
import { createProcedureSchema } from "../schemas/procedures/createProcedureSchema";
import { editProcedureSchema } from "../schemas/procedures/editProcedureSchema";
import { deleteProcedureSchema } from "../schemas/procedures/deleteProcedureSchema";
import { isAdmin } from "../middlewares/isAdmin";

const routes = Router();
const procedureController = makeProcedureController();

routes.get("/", procedureController.findActiveProcedures);

routes.get(
  "/all",
  isAuthenticated,
  isAdmin,
  procedureController.findAllProcedures,
);

routes.post(
  "/",
  isAuthenticated,
  isAdmin,
  validateSchema(createProcedureSchema),
  procedureController.createNewProcedure,
);

routes.put(
  "/:id",
  isAuthenticated,
  isAdmin,
  validateSchema(editProcedureSchema),
  procedureController.editProcedure,
);

routes.delete(
  "/:id",
  isAuthenticated,
  isAdmin,
  validateSchema(deleteProcedureSchema),
  procedureController.deleteProcedure,
);

export { routes };
