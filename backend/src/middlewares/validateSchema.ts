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
      if (validated.query) req.query = validated.query;
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
