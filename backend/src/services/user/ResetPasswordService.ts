import prismaClient from "../../prisma/index";
import crypto from "crypto";
import bcrypt from "bcrypt";

interface tokenProps {
  token: string;
  newPassword: string;
}
export class ResetPasswordService {
  async execute({ token, newPassword }: tokenProps) {
    if (!token) {
      throw new Error("Token inválido ou expirado!");
    }
    //Coleta o token correto e faz o hash para comparar com o banco de dados
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    //Gera o hash da senha antes de iniciar transações no banco para
    //diminuir intervalo entre tratativas no banco, evitando dupla solicitação com mesmo token
    const newPasswordHashed = await bcrypt.hash(newPassword, 10);

    //Faz update no used para true e valida se existe na mesma chamada
    //Por ser a primeira coisa feita, isso vai evitar dupla solicitação

    const tokenUpdate = await prismaClient.passwordResetToken.updateMany({
      where: {
        token_hash: hashedToken,
        used: false,
        expiresAt: { gt: new Date() },
      },
      data: {
        used: true,
      },
    });

    // Valida o token
    if (tokenUpdate.count === 0) {
      throw new Error("Token inválido ou expirado!");
    }

    //Agora sim coleta os dados do token de forma segura com o findFirst
    const tokenData = await prismaClient.passwordResetToken.findFirst({
      where: { token_hash: hashedToken }, //procura o token no banco
      select: { userId: true }, //retorna o UserID vinculado ao token
    });

    //Verifica 
    if (!tokenData) {
      throw new Error("Usuário não encontrado para este token.");
    }

    //Atualiza a senha no banco  de dados
    await prismaClient.users.update({
      where: { id: tokenData.userId },
      data: { password_hash: newPasswordHashed },
    });

    return "Senha alterada com sucesso!";
  }
}
