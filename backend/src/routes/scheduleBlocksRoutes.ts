import { Router } from "express";
import { validateSchema } from "../middlewares/validateSchema";
import { isAuthenticated } from "../middlewares/isAuthenticatedMiddleware";
import { isAdmin } from "../middlewares/isAdmin";
import { makeScheduleBlocksController } from "../app/scheduleBlocks/scheduleBlocks.factory";
import { newScheduleBlockSchema } from "../schemas/scheduleBlocks/createScheduleBlock.schema";

const routes = Router();

routes.post(
  "/newscheduleblock",
  validateSchema(newScheduleBlockSchema),
  isAuthenticated,
  isAdmin,
  makeScheduleBlocksController().createScheduleBlock,
);

export { routes };
