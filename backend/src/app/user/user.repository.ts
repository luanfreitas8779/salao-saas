import prismaClient from "../../prisma/index";
import { Users, PasswordResetToken } from "../../generated/prisma/client";

interface FindUserByEmailProps {
  email: string;
}

interface FindUserByPhoneProps {
  phone: string;
}

interface FindUserByIdProps {
  id: string;
}

interface CreateUserProps {
  name: string;
  email: string;
  phone: string;
  password_hash: string;
}

interface UpdateProfileProps {
  id: string;
  phone?: string;
  password_hash?: string;
}

interface UpdateUserPasswordProps {
  userId: string;
  newPasswordHash: string;
}

interface FindPasswordResetTokenProps {
  hashedToken: string;
}

interface MarkPasswordResetTokenAsUsedProps {
  hashedToken: string;
}

interface CreatePasswordResetTokenProps {
  userId: string;
  token_hash: string;
  expiresAt: Date;
}

export class UserRepository {
  async findUserByEmail({
    email,
  }: FindUserByEmailProps): Promise<Users | null> {
    const user = await prismaClient.users.findUnique({
      where: { email: email },
    });
    return user;
  }

  async findUserByPhone({
    phone,
  }: FindUserByPhoneProps): Promise<Users | null> {
    const user = await prismaClient.users.findUnique({
      where: { phone: phone },
    });
    return user;
  }

  async findUserById({ id }: FindUserByIdProps): Promise<Users | null> {
    return prismaClient.users.findUnique({
      where: { id },
    });
  }

  async updateProfile({ id, phone, password_hash }: UpdateProfileProps) {
    return prismaClient.users.update({
      where: { id },
      data: {
        ...(phone ? { phone } : {}),
        ...(password_hash ? { password_hash } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async createUser({
    name,
    email,
    phone,
    password_hash,
  }: CreateUserProps): Promise<Users> {
    const user = await prismaClient.users.create({
      data: {
        name: name,
        email: email,
        phone: phone,
        password_hash: password_hash,
      },
    });
    return user;
  }

  async findPasswordResetToken({
    hashedToken,
  }: FindPasswordResetTokenProps): Promise<PasswordResetToken | null> {
    const resetToken = await prismaClient.passwordResetToken.findUnique({
      where: { token_hash: hashedToken },
    });
    return resetToken;
  }

  //Marca o token como usado só se ele ainda vale (não usado e não expirado).
  //updateMany não lança erro quando não acha nada: devolve { count: 0 }.
  //Como a checagem e a marcação são uma única operação no banco, dois pedidos
  //simultâneos com o mesmo token não conseguem os dois usá-lo.
  async markPasswordResetTokenAsUsed({
    hashedToken,
  }: MarkPasswordResetTokenAsUsedProps): Promise<boolean> {
    const { count } = await prismaClient.passwordResetToken.updateMany({
      where: {
        token_hash: hashedToken,
        used: false,
        expiresAt: { gt: new Date() },
      },
      data: { used: true },
    });
    return count > 0;
  }

  async updateUserPassword({
    userId,
    newPasswordHash,
  }: UpdateUserPasswordProps) {
    const updatedUser = await prismaClient.users.update({
      where: { id: userId },
      data: { password_hash: newPasswordHash },
    });
    return updatedUser;
  }

  async createPasswordResetToken({
    userId,
    token_hash,
    expiresAt,
  }: CreatePasswordResetTokenProps): Promise<PasswordResetToken> {
    const token = await prismaClient.passwordResetToken.create({
      data: {
        userId: userId,
        token_hash: token_hash,
        expiresAt: expiresAt,
      },
    });
    return token;
  }
}
