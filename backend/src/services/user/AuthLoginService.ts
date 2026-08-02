import { compare } from "bcrypt";
import prismaClient from "../../prisma/index";
import { sign } from "jsonwebtoken";
import "dotenv/config";

interface AuthLoginProps {
  email: string;
  password: string;
}

interface AuthLoginResponse {
  id: string;
  name: string;
  role: string;
  token: string;
}

class AuthLoginService {
  async execute({
    email,
    password,
  }: AuthLoginProps): Promise<AuthLoginResponse> {
    //Verificar se o email existe
    const user = await prismaClient.users.findFirst({
      where: {
        email: email,
      },
    });

    if (!user) {
      await compare(password, "$2b$10$FakeHashToPreventTimingAttacksVariables");
      throw new Error("Email ou senha incorretos");
    }

    //Verificar se a senha está correta
    const passwordMatch = await compare(password, user.password_hash);

    if (!passwordMatch) {
      throw new Error("Email ou senha incorretos");
    }

    //Gerar TOKEN JWT
    if (!process.env.JWT_SECRET) {
      throw new Error("CHAVE DE CRIPTOGRAFIA NÃO ENCONTRADA");
    }
    const token = sign({}, process.env.JWT_SECRET as string, {
      subject: user.id,
      expiresIn: "7d",
    });

    return {
      id: user.id,
      name: user.name,
      role: user.role,
      token: token,
    };
  }
}

export { AuthLoginService };
