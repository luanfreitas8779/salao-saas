import { z } from "zod";

export const recoveryPasswordSchema = z.object({
  body: z.object({
    email: z.email({ error: "Formato de email inválido" }),
  }),
});
