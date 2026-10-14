import { UserRepository } from "./user.repository";
import { UserService } from "./user.service";
import { UserController } from "./user.controller";

export const makeUserController = (): UserController => {
  const userRepository = new UserRepository();
  const userService = new UserService(userRepository);

  return new UserController(userService);
};
