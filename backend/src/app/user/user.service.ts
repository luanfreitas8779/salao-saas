import { compare } from "bcrypt";
import { sign } from "jsonwebtoken";
import { BadRequestError, ConflictError, InternalServerError, NotFoundError, UnauthorizedError } from "../../errors/app-error";
import { UserRepository } from "./user.repository";
import bcrypt from "bcrypt";
import { sendMail } from "../../config/mailer";
import crypto from "crypto";
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

interface CreateNewUserProps {
    name: string;
    email: string;
    phone: string;
    password: string;
}

export class UserService {
    constructor(private readonly repository: UserRepository) {}

    async authLogin({
    email,
    password,
  }: AuthLoginProps): Promise<AuthLoginResponse> {
    //Verificar se o email existe
    const user = await this.repository.findUserByEmail({ email: email });

    if (!user) {
      await compare(password, "$2b$10$FakeHashToPreventTimingAttacksVariables");
      throw new UnauthorizedError("Email ou senha incorretos");
    }

    //Verificar se a senha está correta
    const passwordMatch = await compare(password, user.password_hash);

    if (!passwordMatch) {
      throw new UnauthorizedError("Email ou senha incorretos");
    }

    //Gerar TOKEN JWT
    if (!process.env.JWT_SECRET) {
      throw new InternalServerError("CHAVE DE CRIPTOGRAFIA NÃO ENCONTRADA");
    }
    const token = sign(
      { role: user.role },
      process.env.JWT_SECRET as string,
      {
        subject: user.id,
        expiresIn: "30d",
      },
    );

    return {
      id: user.id,
      name: user.name,
      role: user.role,
      token: token,
    };
  }

  async CreateNewUser({
    name,
    email,
    phone,
    password,
  }: CreateNewUserProps): Promise<string> {

    const [emailExists, phoneExists] = await Promise.all([
      this.repository.findUserByEmail({ email: email }),
      this.repository.findUserByPhone({ phone: phone }),
    ]);

    if (emailExists) {
      throw new ConflictError("Já existe um usuário com este email!");
    }

    if (phoneExists) {
      throw new ConflictError("Já existe um usuário com este número de telefone!");
    }

    const password_hash = await bcrypt.hash(password, 10);

    const user = await this.repository.createUser({
      name: name,
      email: email,
      phone: phone,
      password_hash: password_hash,
    });
    

    return user.name;
    }

    async recoveryPassword({ email }: { email: string }): Promise<string> {
        const userExists = await this.repository.findUserByEmail({ email: email });

    if (!userExists) {
      throw new BadRequestError("Se o email existir, enviaremos o token por email!");
    }
    
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 15); // 15 min

    const newToken = await this.repository.createPasswordResetToken({
      userId: userExists.id,
      token_hash: hashedToken,
      expiresAt: expiresAt,
    });

    if(!newToken) {
      throw new InternalServerError("Erro ao criar token de recuperação de senha.");
    }

    try{
    await sendMail(
      userExists.email,
      "Recuperação de senha",
      `<h2> Olá ${userExists.name}</h2>
        <p>Você solicitou redefinição de senha. Clique no link abaixo para redefinir sua senha!</p>
        <a href="http://localhost:3333/auth/recoverypassword/${rawToken}">👉 Redefinir minha senha!</a>
        <p>Este link expira em 15 minutos!</p>`,
    );
    }catch (error) {
      throw new InternalServerError("Erro ao enviar email de recuperação de senha.");
    }

    return "Se esse email existir, enviaremos o link de recuperação.";
    }

    async resetPassword({ token, newPassword }: { token: string; newPassword: string }): Promise<string> {
        if (!token) {
      throw new BadRequestError("Token inválido ou expirado!");
    }
    //Coleta o token correto e faz o hash para comparar com o banco de dados
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    //Gera o hash da senha antes de iniciar transações no banco para
    //diminuir intervalo entre tratativas no banco, evitando dupla solicitação com mesmo token
    const newPasswordHashed = await bcrypt.hash(newPassword, 10);

    //Faz update no used para true e valida se existe na mesma chamada
    //Por ser a primeira coisa feita, isso vai evitar dupla solicitação

    const tokenUpdate = await this.repository.updatePasswordResetToken({hashedToken: hashedToken})

    // Valida o token
    if (!tokenUpdate) {
      throw new BadRequestError("Token inválido ou expirado!");
    }

    //Agora sim coleta os dados do token de forma segura com o findFirst
    const tokenData = await this.repository.findPasswordResetToken({ hashedToken: hashedToken });

    //Verifica 
    if (!tokenData) {
      throw new BadRequestError("Usuário não encontrado para este token.");
    }

    //Atualiza a senha no banco de dados
    const updatePassword = await this.repository.updateUserPassword({
      userId: tokenData.userId,
      newPasswordHash: newPasswordHashed,
    });

    if(!updatePassword) {
      throw new InternalServerError("Erro ao atualizar a senha do usuário.");
    }

    return "Senha alterada com sucesso!";
    }

    async getUserById({ id }: { id: string }) {
      const user = await this.repository.findUserById({ id });

      if (!user) {
        throw new NotFoundError("Usuário não encontrado");
      }

      const { password_hash, ...safeUser } = user;
      return safeUser;
    }

    async updateProfile({
      id,
      phone,
      password,
    }: {
      id: string;
      phone?: string;
      password?: string;
    }) {
      if (phone) {
        const phoneOwner = await this.repository.findUserByPhone({ phone });
        if (phoneOwner && phoneOwner.id !== id) {
          throw new ConflictError(
            "Já existe um usuário com este número de telefone!",
          );
        }
      }

      const password_hash = password
        ? await bcrypt.hash(password, 10)
        : undefined;

      return this.repository.updateProfile({ id, phone, password_hash });
    }

}