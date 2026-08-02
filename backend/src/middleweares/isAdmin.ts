import { Request, Response, NextFunction } from "express";
import prismaClient from "../prisma/index";

export async function isAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = req.user_id;

  if (!userId) {
    res
      .status(401)
      .json({ Error: "Usuário sem permissão para executar esta ação!" });
    return;
  }

  const user = await prismaClient.users.findFirst({
    where: {
      id: userId,
    },
  });

  if (!user) {
    res
      .status(401)
      .json({ Error: "Usuário sem permissão para executar esta ação!" });
    return;
  }

  if (user!.role !== "ADMIN") {
    res
      .status(401)
      .json({ Error: "Usuário sem permissão para executar esta ação!" });
    return;
  }

  next();
}
