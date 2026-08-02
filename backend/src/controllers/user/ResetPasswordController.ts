import { Request, Response } from "express";
import { ResetPasswordService } from "../../services/user/ResetPasswordService";

export class ResetPasswordController {
  async handle(req: Request, res: Response) {
    const { token } = req.params;

    //correção do erro de tipagem do express, forçando o token ser uma string única, se chegar qualquer coisa que não seja o token, as proteções do service bloqueiam.
    const tokenString: string = `${token}`;

    const { newPassword } = req.body;

    const resetPassword = new ResetPasswordService();

    const sucess = await resetPassword.execute({
      token: tokenString,
      newPassword: newPassword,
    });

    res.json({ message: sucess });
  }
}
