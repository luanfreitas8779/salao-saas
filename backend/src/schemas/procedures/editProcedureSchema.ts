import { z } from "zod";

export const editProcedureSchema = z.object({
  body: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    price: z.number("O Valor precisa ser um número").int("Formato inválido"),
    duration_minutes: z
      .number("A duração precisa ser um número")
      .int("Formato inválido"),
  }),
});
