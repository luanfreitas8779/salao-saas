import { Request, Response, NextFunction } from "express";
import { ZodError, ZodType } from "zod";

interface RequestSchema {
  body?: any;
  query?: any;
  params?: any;
}

export const validateSchema =
  (schema: ZodType) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = (await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      })) as RequestSchema;

      if (parsed.body) req.body = parsed.body;
      if (parsed.query) req.query = parsed.query;
      if (parsed.params) req.params = parsed.params;

      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: "Erro de validação",
          details: error.issues.map((issue) => ({
            campo: issue.path.slice(1).join("."),
            message: issue.message,
          })),
        });
      }

      res.status(500).json({ message: "Erro interno do servidor!" });
    }
  };
