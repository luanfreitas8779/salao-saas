import jwt from "jsonwebtoken";
import { UnauthorizedError } from "../errors/app-error";
import { Request, Response, NextFunction } from "express";

interface TokenPayload {
  sub: string;
  role?: string;
}

export function isAuthenticated(
  req: Request,
  _: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new UnauthorizedError("Token não informado");
  }

  const [, token] = authHeader!.split(" ");

  try {
    const { sub, role } = jwt.verify(
      token!,
      process.env.JWT_SECRET as string,
    ) as TokenPayload;

    req.user_id = sub;
    req.user_role = role;

    next();
  } catch (err) {
    throw new UnauthorizedError("Autenticação falhou, faça login novamente");
  }
}
