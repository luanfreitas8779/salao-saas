import { Router } from "express";
import { validateSchema } from "../middlewares/validateSchema";
import { createUserSchema } from "../schemas/users/userSchema";
import {
  loginRateLimiter,
  recoveryPasswordLimiter,
} from "../middlewares/rateLimiterMiddleware";
import { authLoginSchema } from "../schemas/users/authLoginSchema";
import { recoveryPasswordSchema } from "../schemas/users/recoveryPasswordSchema";
import { resetPasswordSchema } from "../schemas/users/resetPasswordSchema";
import { isAuthenticated } from "../middlewares/isAuthenticatedMiddleware";
import { makeUserController } from "../app/user/user.factory";
import { updateProfileSchema } from "../schemas/users/updateProfileSchema";

const routes = Router();
const userController = makeUserController();

routes.post(
  "/auth/register",
  validateSchema(createUserSchema),
  userController.CreateNewUser,
);

routes.post(
  "/auth/login",
  loginRateLimiter,
  validateSchema(authLoginSchema),
  userController.authLogin,
);

routes.post(
  "/auth/recoverypassword",
  recoveryPasswordLimiter,
  validateSchema(recoveryPasswordSchema),
  userController.recoveryPassword,
);

routes.post(
  "/auth/resetpassword/:token",
  validateSchema(resetPasswordSchema),
  userController.resetPassword,
);

routes.get("/profile", isAuthenticated, userController.getUserById);

routes.patch(
  "/profile",
  isAuthenticated,
  validateSchema(updateProfileSchema),
  userController.updateProfile,
);

export { routes };
