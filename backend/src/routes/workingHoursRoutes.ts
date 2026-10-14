import { Router } from "express";
import { validateSchema } from "../middlewares/validateSchema";
import { workingHoursSchema } from "../schemas/workingHours/workingHoursSchema";
import { isAuthenticated } from "../middlewares/isAuthenticatedMiddleware";
import { isAdmin } from "../middlewares/isAdmin";
import { makeWorkingHoursController } from "../app/workingHours/workingHours.factory";

const routes = Router();
const workingHoursController = makeWorkingHoursController();

routes.put(
  "/",
  isAuthenticated,
  isAdmin,
  validateSchema(workingHoursSchema),
  workingHoursController.handle,
);

export { routes };
