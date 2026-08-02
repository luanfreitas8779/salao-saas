import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

interface Payload {
  sub: string;
}

export function isAuthenticated(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authToken = req.headers.authorization;

  if (!authToken) {
    res
      .status(401)
      .json({ Error: "Token não fornecido, faça login novamente!" });
    return;
  }

  const [, token] = authToken!.split(" ");

  try {
    const { sub } = jwt.verify(
      token!,
      process.env.JWT_SECRET as string,
    ) as Payload;

    req.user_id = sub;

    next();
  } catch (err) {
    res.status(401).json({ Error: "Token inválido, faça login novamente!" });
    return;
  }
}
