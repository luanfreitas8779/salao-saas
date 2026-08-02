import { Request, Response } from "express";
import { RecoveryPasswordService } from "../../services/user/RecoveryPasswordService";

export class RecoveryPasswordController {
  async handle(req: Request, res: Response) {
    const { email } = req.body;

    const recoveryPassword = new RecoveryPasswordService();

    const sucess = await recoveryPassword.execute({
      email: email,
    });

    res.json(sucess);
  }
}
