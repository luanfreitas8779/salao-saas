import { Router } from "express";
import { validateSchema } from "../middlewares/validateSchema";
import { appointmentAvailabilitySchema } from "../schemas/appointments/appointmentAvailabilitySchema";
import { isAuthenticated } from "../middlewares/isAuthenticatedMiddleware";
import { createAppointmentSchema } from "../schemas/appointments/createAppointmentSchema";
import { makeAppointmentController } from "../app/appointments/appointments.factory";
import { appointmentBoardSchema } from "../schemas/appointments/appointmentBoardSchema";
import { appointmentIdParamSchema } from "../schemas/appointments/appointmentIdParamSchema";
import { updateAppointmentSchema } from "../schemas/appointments/updateAppointmentSchema";
import { isAdmin } from "../middlewares/isAdmin";

const routes = Router();
const appointmentController = makeAppointmentController();

routes.get(
  "/slots",
  validateSchema(appointmentAvailabilitySchema),
  isAuthenticated,
  appointmentController.availableTimes,
);

routes.get(
  "/availability",
  validateSchema(appointmentAvailabilitySchema),
  isAuthenticated,
  appointmentController.availableTimes,
);

routes.post(
  "/",
  isAuthenticated,
  validateSchema(createAppointmentSchema),
  appointmentController.createAppointment,
);

routes.get("/me", isAuthenticated, appointmentController.listMine);

routes.get(
  "/board",
  isAuthenticated,
  isAdmin,
  validateSchema(appointmentBoardSchema),
  appointmentController.listBoard,
);

routes.patch(
  "/:id/cancel",
  isAuthenticated,
  validateSchema(appointmentIdParamSchema),
  appointmentController.cancelAppointment,
);

routes.patch(
  "/:id",
  isAuthenticated,
  validateSchema(updateAppointmentSchema),
  appointmentController.updateAppointment,
);

export { routes };
