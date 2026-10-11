import { Request, Response, NextFunction } from "express"
import { UnauthorizedError } from "../errors/app-error";
import prismaClient from "../prisma/index";

export async function isAdmin(
  req: Request,
  _: Response,
  next: NextFunction,
): Promise<void> {
  const userId = req.user_id;

  if (!userId) {
    throw new UnauthorizedError("Usuário não autenticado");
  }

  const user = await prismaClient.users.findFirst({
    where: {
      id: userId,
    },
  });

  if (!user) {
    throw new UnauthorizedError("Usuário não autenticado");
  }

  req.user_role = user.role;

  if (user.role !== "ADMIN") {
    throw new UnauthorizedError("Usuário sem permissão");
  }

  next();
}
