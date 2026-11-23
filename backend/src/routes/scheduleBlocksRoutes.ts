import { Router } from "express";
import { validateSchema } from "../middlewares/validateSchema";
import { isAuthenticated } from "../middlewares/isAuthenticatedMiddleware";
import { isProf } from "../middlewares/isProf";
import { makeScheduleBlocksController } from "../app/scheduleBlocks/scheduleBlocks.factory";
import { newScheduleBlockSchema } from "../schemas/scheduleBlocks/createScheduleBlockSchema";
import { listScheduleBlocksSchema } from "../schemas/scheduleBlocks/listScheduleBlocksSchema";
import { updateScheduleBlockSchema } from "../schemas/scheduleBlocks/updateScheduleBlockSchema";
import { scheduleBlockIdParamSchema } from "../schemas/scheduleBlocks/scheduleBlockIdParamSchema";

const routes = Router();
const scheduleBlocksController = makeScheduleBlocksController();

routes.get(
  "/",
  isAuthenticated,
  isProf,
  validateSchema(listScheduleBlocksSchema),
  scheduleBlocksController.listScheduleBlocks,
);

routes.post(
  "/",
  isAuthenticated,
  isProf,
  validateSchema(newScheduleBlockSchema),
  scheduleBlocksController.createScheduleBlock,
);

routes.put(
  "/:id",
  isAuthenticated,
  isProf,
  validateSchema(updateScheduleBlockSchema),
  scheduleBlocksController.updateScheduleBlock,
);

routes.delete(
  "/:id",
  isAuthenticated,
  isProf,
  validateSchema(scheduleBlockIdParamSchema),
  scheduleBlocksController.deleteScheduleBlock,
);

export { routes };
