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
import { makeUserController } from "../app/user/user.factory";

const routes = Router();
const userController = makeUserController();

routes.post(
  "/register",
  validateSchema(createUserSchema),
  userController.CreateNewUser,
);

routes.post(
  "/login",
  loginRateLimiter,
  validateSchema(authLoginSchema),
  userController.authLogin,
);

routes.post(
  "/recover",
  recoveryPasswordLimiter,
  validateSchema(recoveryPasswordSchema),
  userController.recoveryPassword,
);

routes.post(
  "/reset-password/:token",
  validateSchema(resetPasswordSchema),
  userController.resetPassword,
);

export { routes };
