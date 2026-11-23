import jwt from "jsonwebtoken";
import { ForbiddenError, UnauthorizedError } from "../errors/app-error";
import { Request, Response, NextFunction } from "express";
import { env } from "../schemas/validateEnvSchema";
import prismaClient from "../prisma/index";

interface TokenPayload {
  sub: string;
  role?: string;
  ver?: number;
}

//Confere o token e, no banco, se ele ainda é o token ativo do usuário.
//Cada usuário tem um único token ativo: login e troca de senha aumentam o
//token_version, e um token com a versão antiga deixa de valer na hora.
async function authenticate(req: Request, allowPendingPasswordChange: boolean) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new UnauthorizedError("Token não informado");
  }

  const [, token] = authHeader.split(" ");

  let payload: TokenPayload;
  try {
    payload = jwt.verify(token!, env.JWT_SECRET) as TokenPayload;
  } catch {
    throw new UnauthorizedError("Autenticação falhou, faça login novamente");
  }

  const user = await prismaClient.users.findUnique({
    where: { id: payload.sub },
    select: { id: true, role: true, token_version: true, must_change_password: true },
  });

  if (!user || user.token_version !== payload.ver) {
    throw new UnauthorizedError("Sessão encerrada, faça login novamente");
  }

  //Primeiro acesso: com a senha inicial, a pessoa só consegue trocar a senha
  if (user.must_change_password && !allowPendingPasswordChange) {
    throw new ForbiddenError("Troque a senha antes de continuar");
  }

  req.user_id = user.id;
  //o papel vem do banco: se mudou depois do login, vale o atual
  req.user_role = user.role;
}

export async function isAuthenticated(req: Request, _: Response, next: NextFunction) {
  await authenticate(req, false);
  next();
}

//Só para a rota de troca de senha (PATCH /users/profile): deixa passar quem
//ainda precisa trocar a senha inicial. Todo o resto do isAuthenticated vale.
export async function isAuthenticatedAllowingPasswordChange(
  req: Request,
  _: Response,
  next: NextFunction,
) {
  await authenticate(req, true);
  next();
}
