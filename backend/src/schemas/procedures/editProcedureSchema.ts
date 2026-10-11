import { z } from "zod";

export const editProcedureSchema = z.object({
  params: z.object({
    id: z.uuid(),
  }),
  body: z.object({
    name: z.string(),
    description: z.string(),
    price: z.number("O Valor precisa ser um número").int("Formato inválido"),
    duration_minutes: z
      .number("A duração precisa ser um número")
      .int("Formato inválido"),
  }),
});
