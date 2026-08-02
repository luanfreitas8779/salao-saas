import { Request, Response } from "express";
import { AuthLoginService } from "../../services/user/AuthLoginService";

class AuthLoginController {
  async handle(req: Request, res: Response) {
    const { email, password } = req.body;

    const authLoginService = new AuthLoginService();

    const session = await authLoginService.execute({
      email: email,
      password: password,
    });

    res.json(session);
  }
}

export { AuthLoginController };
