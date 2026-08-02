import { z } from "zod";

export const authLoginSchema = z.object({
  body: z.object({
    email: z.email({ message: "Digite um email válido!" }),
    password: z.string({ message: "Senha deve ser uma STRING" }).min(6),
  }),
});
