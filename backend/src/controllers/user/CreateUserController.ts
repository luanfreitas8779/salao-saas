import { Request, Response } from "express";
import { CreateUserService } from "../../services/user/CreateUserService";

class CreateUserController {
  async handle(req: Request, res: Response) {
    const { name, email, phone, password } = req.body;

    const createUserService = new CreateUserService();
    const user = await createUserService.execute({
      name: name,
      email: email,
      phone: phone,
      password: password,
    });

    res.json(user);
  }
}

export { CreateUserController };
