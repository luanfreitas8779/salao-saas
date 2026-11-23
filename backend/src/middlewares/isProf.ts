import { Request, Response, NextFunction } from "express";
import { ForbiddenError, UnauthorizedError } from "../errors/app-error";

//Só deixa passar o profissional do salão (PROF).
//Vem sempre depois do isAuthenticated, que já buscou o usuário no banco e
//preencheu o req.user_role com o papel ATUAL (não o do momento do login).
export async function isProf(
  req: Request,
  _: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.user_id) {
    throw new UnauthorizedError("Usuário não autenticado");
  }

  if (req.user_role !== "PROF") {
    throw new ForbiddenError("Usuário sem permissão");
  }

  next();
}
