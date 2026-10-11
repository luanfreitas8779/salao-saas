import { Router } from "express";
import { validateSchema } from "../middlewares/validateSchema";
import { isAuthenticated } from "../middlewares/isAuthenticatedMiddleware";
import { makeUserController } from "../app/user/user.factory";
import { updateProfileSchema } from "../schemas/users/updateProfileSchema";

const routes = Router();
const userController = makeUserController();

routes.get("/profile", isAuthenticated, userController.getUserById);

routes.patch(
  "/profile",
  isAuthenticated,
  validateSchema(updateProfileSchema),
  userController.updateProfile,
);

export { routes };
