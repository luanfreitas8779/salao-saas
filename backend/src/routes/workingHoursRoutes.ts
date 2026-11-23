import { Router } from "express";
import { validateSchema } from "../middlewares/validateSchema";
import { workingHoursSchema } from "../schemas/workingHours/workingHoursSchema";
import { isAuthenticated } from "../middlewares/isAuthenticatedMiddleware";
import { isProf } from "../middlewares/isProf";
import { makeWorkingHoursController } from "../app/workingHours/workingHours.factory";

const routes = Router();
const workingHoursController = makeWorkingHoursController();

routes.get("/", workingHoursController.listWorkingHours);

routes.put(
  "/",
  isAuthenticated,
  isProf,
  validateSchema(workingHoursSchema),
  workingHoursController.updateWorkingHours,
);

export { routes };
