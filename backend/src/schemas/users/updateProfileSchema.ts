import { z } from "zod";

const phoneSchema = z
  .string()
  .transform((val) => val.replace(/\D/g, ""))
  .pipe(
    z
      .string()
      .min(10, { message: "O número deve conter DDD + 8 dígitos" })
      .max(11, { message: "O número deve conter no máximo 11 dígitos" }),
  );

export const updateProfileSchema = z.object({
  body: z
    .object({
      phone: phoneSchema.optional(),
      password: z
        .string()
        .min(6, { message: "A senha deve ter no mínimo 6 caracteres" })
        .optional(),
    })
    .refine((data) => data.phone !== undefined || data.password !== undefined, {
      message: "Informe telefone e/ou senha para atualizar",
    }),
});
