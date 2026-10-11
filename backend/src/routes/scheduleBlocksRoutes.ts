import { Router } from "express";
import { validateSchema } from "../middlewares/validateSchema";
import { isAuthenticated } from "../middlewares/isAuthenticatedMiddleware";
import { isAdmin } from "../middlewares/isAdmin";
import { makeScheduleBlocksController } from "../app/scheduleBlocks/scheduleBlocks.factory";
import { newScheduleBlockSchema } from "../schemas/scheduleBlocks/createScheduleBlockSchema";

const routes = Router();

routes.post(
  "/",
  isAuthenticated,
  isAdmin,
  validateSchema(newScheduleBlockSchema),
  makeScheduleBlocksController().createScheduleBlock,
);

export { routes };
