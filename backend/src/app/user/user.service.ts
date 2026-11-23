import { compare, hash } from "bcrypt";
import { sign } from "jsonwebtoken";
import {
  BadRequestError,
  ConflictError,
  InternalServerError,
  NotFoundError,
  UnauthorizedError,
} from "../../errors/app-error";
import { UserRepository } from "./user.repository";
import { sendMail } from "../../config/mailer";
import crypto from "crypto";
import { env } from "../../schemas/validateEnvSchema";

interface AuthLoginProps {
  email: string;
  password: string;
}

interface AuthLoginResponse {
  id: string;
  name: string;
  role: string;
  must_change_password: boolean;
  token: string;
}

interface CreateNewUserProps {
  name: string;
  email: string;
  phone: string;
  password: string;
}

interface RecoveryPasswordProps {
  email: string;
}

interface ResetPasswordProps {
  token: string;
  newPassword: string;
}

interface GetUserByIdProps {
  id: string;
}

interface SearchClientsProps {
  search: string;
}

interface UpdateProfileProps {
  id: string;
  phone?: string;
  password?: string;
}

//Remove os campos internos de segurança antes de devolver um usuário para fora do service
function toPublicUser<T extends { password_hash: string; token_version: number }>(user: T) {
  const { password_hash: _hash, token_version: _version, ...publicUser } = user;
  return publicUser;
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

    //Um único token ativo: a versão nova revoga o token do login anterior
    const tokenVersion = await this.repository.incrementTokenVersion({
      userId: user.id,
    });

    //Gerar TOKEN JWT
    //O JWT_SECRET sempre existe aqui: sem ele o servidor nem sobe (validateEnvSchema)
    const token = sign({ role: user.role, ver: tokenVersion }, env.JWT_SECRET, {
      subject: user.id,
      expiresIn: "30d",
    });

    return {
      id: user.id,
      name: user.name,
      role: user.role,
      must_change_password: user.must_change_password,
      token: token,
    };
  }

  async CreateNewUser({
    name,
    email,
    phone,
    password,
  }: CreateNewUserProps) {
    const [userWithEmail, userWithPhone] = await Promise.all([
      this.repository.findUserByEmail({ email: email }),
      this.repository.findUserByPhone({ phone: phone }),
    ]);

    if (userWithEmail) {
      throw new ConflictError("Já existe um usuário com este email!");
    }

    if (userWithPhone) {
      throw new ConflictError(
        "Já existe um usuário com este número de telefone!",
      );
    }

    const password_hash = await hash(password, 10);

    const user = await this.repository.createUser({
      name: name,
      email: email,
      phone: phone,
      password_hash: password_hash,
    });

    return toPublicUser(user);
  }

  async recoveryPassword({ email }: RecoveryPasswordProps): Promise<string> {
    //Mesma resposta para email existente ou não, evitando descobrir quem é cliente
    const genericMessage =
      "Se esse email existir, enviaremos o link de recuperação.";

    const user = await this.repository.findUserByEmail({ email: email });

    if (!user) {
      return genericMessage;
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 15); // 15 min

    const resetToken = await this.repository.createPasswordResetToken({
      userId: user.id,
      token_hash: hashedToken,
      expiresAt: expiresAt,
    });

    if (!resetToken) {
      throw new InternalServerError(
        "Erro ao criar token de recuperação de senha.",
      );
    }

    try {
      await sendMail(
        user.email,
        "Recuperação de senha",
        `<h2> Olá ${user.name}</h2>
        <p>Você solicitou redefinição de senha. Clique no link abaixo para redefinir sua senha!</p>
        <a href="${env.FRONTEND_URL}/reset-password/${rawToken}">👉 Redefinir minha senha!</a>
        <p>Este link expira em 15 minutos!</p>`,
      );
    } catch (error) {
      throw new InternalServerError(
        "Erro ao enviar email de recuperação de senha.",
      );
    }

    return genericMessage;
  }

  async resetPassword({
    token,
    newPassword,
  }: ResetPasswordProps): Promise<string> {
    if (!token) {
      throw new BadRequestError("Token inválido ou expirado!");
    }
    //Coleta o token correto e faz o hash para comparar com o banco de dados
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    //Gera o hash da senha antes de iniciar transações no banco para
    //diminuir intervalo entre tratativas no banco, evitando dupla solicitação com mesmo token
    const newPasswordHash = await hash(newPassword, 10);

    //Valida e marca o token como usado na mesma chamada: só passa se ele existe,
    //não foi usado e não expirou. Por ser a primeira coisa feita, evita dupla solicitação
    const tokenWasValid = await this.repository.markPasswordResetTokenAsUsed({
      hashedToken: hashedToken,
    });

    if (!tokenWasValid) {
      throw new BadRequestError("Token inválido ou expirado!");
    }

    //Agora sim coleta os dados do token de forma segura com o findFirst
    const resetToken = await this.repository.findPasswordResetToken({
      hashedToken: hashedToken,
    });

    if (!resetToken) {
      throw new BadRequestError("Usuário não encontrado para este token.");
    }

    //Atualiza a senha no banco de dados
    const updatedUser = await this.repository.updateUserPassword({
      userId: resetToken.userId,
      newPasswordHash: newPasswordHash,
    });

    if (!updatedUser) {
      throw new InternalServerError("Erro ao atualizar a senha do usuário.");
    }

    //A senha mudou: quem estiver logado com ela (inclusive um invasor) é desconectado
    await this.repository.incrementTokenVersion({ userId: resetToken.userId });

    return "Senha alterada com sucesso!";
  }

  async getUserById({ id }: GetUserByIdProps) {
    const user = await this.repository.findUserById({ id });

    if (!user) {
      throw new NotFoundError("Usuário não encontrado");
    }

    return toPublicUser(user);
  }

  async searchClients({ search }: SearchClientsProps) {
    return this.repository.searchClients({ search });
  }

  async updateProfile({ id, phone, password }: UpdateProfileProps) {
    if (phone) {
      const phoneOwner = await this.repository.findUserByPhone({ phone });
      if (phoneOwner && phoneOwner.id !== id) {
        throw new ConflictError(
          "Já existe um usuário com este número de telefone!",
        );
      }
    }

    const password_hash = password ? await hash(password, 10) : undefined;

    const updatedUser = await this.repository.updateProfile({ id, phone, password_hash });

    //A senha mudou: todos os tokens do usuário deixam de valer
    if (password_hash) {
      await this.repository.incrementTokenVersion({ userId: id });
    }

    return updatedUser;
  }
}
