import { NextFunction, Request, Response } from "express";
import { AppError, ValidationError } from "../errors/app-error";

//Handler global de erros: todo erro lançado numa rota termina aqui.
//O Express reconhece um handler de erro por ter 4 parâmetros (error, req, res, next).
//  - AppError (e filhas): usa o statusCode e a mensagem do próprio erro.
//  - ValidationError: além disso, devolve os details (qual campo está errado).
//  - Qualquer outro erro: 500 com mensagem genérica, sem vazar detalhes internos.
export function errorHandler(
  error: Error & Partial<AppError>,
  _: Request,
  res: Response,
  _next: NextFunction,
) {
  const statusCode = error.statusCode ?? 500;
  const message = error.statusCode ? error.message : "Internal Server Error";
  const details = error instanceof ValidationError ? error.details : undefined;
  res.status(statusCode).json({ message, ...(details && { details }) });
}
