import prismaClient from "../../prisma/index";
import { sendMail } from "../../config/mailer";
import crypto from "crypto";

interface RecoveryPasswordProps {
  email: string;
}

export class RecoveryPasswordService {
  async execute({ email }: RecoveryPasswordProps) {
    const userExists = await prismaClient.users.findUnique({
      where: { email: email },
    });

    if (!userExists) {
      throw new Error("Se o email existir, enviaremos o token por email!");
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 15); // 15 min

    await prismaClient.passwordResetToken.create({
      data: {
        userId: userExists.id,
        token_hash: hashedToken,
        expiresAt: expiresAt,
      },
    });

    await sendMail(
      userExists.email,
      "Recuperação de senha",
      `<h2> Olá ${userExists.name}</h2>
        <p>Você solicitou redefinição de senha. Clique no link abaixo para redefinir sua senha!</p>
        <a href="http://localhost:3333/auth/recoverypassword/${rawToken}">👉 Redefinir minha senha!</a>
        <p>Este link expira em 15 minutos!</p>`,
    );

    return "Se esse email existir, enviaremos o link de recuperação.";
  }
}
