import { z } from "zod";

export const createProcedureSchema = z.object({
  body: z.object({
    name: z.string(),
    description: z.string(),
    price: z.number("O preço precisa ser um número").int("Formato inválido"),
    duration_minutes: z
      .number("A duração precisa ser um número!")
      .int("Formato inválido"),
  }),
});
