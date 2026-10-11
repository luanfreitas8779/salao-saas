import jwt from "jsonwebtoken";
import { BadRequestError } from "../errors/app-error";
import { Request, Response, NextFunction } from "express";

interface Payload {
  sub: string;
  role?: string;
}

export function isAuthenticated(
  req: Request,
  _: Response,
  next: NextFunction,
) {
  const authToken = req.headers.authorization;

  if (!authToken) {
    throw new BadRequestError("Token não informado");
  }

  const [, token] = authToken!.split(" ");

  try {
    const { sub, role } = jwt.verify(
      token!,
      process.env.JWT_SECRET as string,
    ) as Payload;

    req.user_id = sub;
    req.user_role = role;

    next();
  } catch (err) {
    throw new BadRequestError("Autenticação falhou, faça login novamente");
    return;
  }
}
