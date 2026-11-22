import { Request, Response, NextFunction } from "express";
import { InternalServerError, ValidationError } from "../errors/app-error";
import { ZodError, ZodType } from "zod";

interface ValidatedRequest {
  body?: any;
  query?: any;
  params?: any;
}

export const validateSchema =
  (schema: ZodType) =>
  async (req: Request, _: Response, next: NextFunction) => {
    try {
      const validated = (await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      })) as ValidatedRequest;

      if (validated.body) req.body = validated.body;
      //No Express 5 o req.query é só leitura (um getter): `req.query = ...`
      //lança TypeError. Por isso a propriedade é redefinida nesta requisição.
      if (validated.query) {
        Object.defineProperty(req, "query", {
          value: validated.query,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }
      if (validated.params) req.params = validated.params;

      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        throw new ValidationError(
          error.issues.map((issue) => ({
            campo: issue.path.slice(1).join("."),
            message: issue.message,
          })),
        );
      }

      throw new InternalServerError("Erro interno do servidor");
    }
  };
