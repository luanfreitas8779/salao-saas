import { z } from "zod";

export const editProcedureSchema = z.object({
  params: z.object({
    id: z.uuid(),
  }),
  body: z.object({
    name: z.string()
    .transform((val) => val.trim())
    .pipe(
      z
      .string()
      .min(3, {message: "O nome do procedimento deve ter no mínimo 3 caracteres"})
    ),

    description: z.string(),

    price: z.number("O preço precisa ser um número").int("Formato inválido").min(500, {message: "O valor mínimo do procedimento deve ser de R$5,00"}),
    duration_minutes: z
      .number("A duração precisa ser um número!")
      .int("Formato inválido")
      .min(1, {message: "A duração deve ser pelo menos 1 minuto"}),
  }),
});
