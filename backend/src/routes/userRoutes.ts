import { Router } from "express";
import { validateSchema } from "../middlewares/validateSchema";
import {
  isAuthenticated,
  isAuthenticatedAllowingPasswordChange,
} from "../middlewares/isAuthenticatedMiddleware";
import { makeUserController } from "../app/user/user.factory";
import { updateProfileSchema } from "../schemas/users/updateProfileSchema";
import { searchClientsSchema } from "../schemas/users/searchClientsSchema";
import { isProf } from "../middlewares/isProf";

const routes = Router();
const userController = makeUserController();

routes.get(
  "/",
  isAuthenticated,
  isProf,
  validateSchema(searchClientsSchema),
  userController.searchClients,
);

routes.get("/profile", isAuthenticated, userController.getUserById);

//Única rota liberada para quem ainda precisa trocar a senha inicial
routes.patch(
  "/profile",
  isAuthenticatedAllowingPasswordChange,
  validateSchema(updateProfileSchema),
  userController.updateProfile,
);

export { routes };
