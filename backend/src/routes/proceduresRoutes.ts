import { Router } from "express";
import { isAuthenticated } from "../middlewares/isAuthenticatedMiddleware";
import { makeProcedureController } from "../app/procedures/procedures.factory";
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
  "/new",
  validateSchema(createProcedureSchema),
  isAuthenticated,
  isAdmin,
  procedureController.createNewProcedure,
);

routes.put(
  "/edit/",
  validateSchema(editProcedureSchema),
  isAuthenticated,
  isAdmin,
  procedureController.editProcedure,
);

routes.delete(
  "/delete",
  validateSchema(deleteProcedureSchema),
  isAuthenticated,
  isAdmin,
  procedureController.deleteProcedure,
);

export { routes };
