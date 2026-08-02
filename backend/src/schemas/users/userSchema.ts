import { z } from "zod";

const phoneSchema = z
  .string()
  .transform((val) => val.replace(/\D/g, "")) // remove tudo que não é dígito
  .pipe(
    z
      .string()
      .min(10, { message: "O número deve conter DDD + 8 dígitos" })
      .max(11, { message: "O número deve conter no máximo 11 dígitos" }),
  );

export const createUserSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(10, { message: "O nome precisa ter no mínimo 10 caracteres" }),
    email: z.email({ message: "Precisa ser um email válido" }),
    phone: phoneSchema,
    password: z
      .string()
      .min(6, { message: "A senha deve ter no mínimo 6 caracteres" }),
  }),
});
