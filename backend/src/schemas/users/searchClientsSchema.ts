import { z } from "zod";

export const searchClientsSchema = z.object({
  query: z.object({
    search: z
      .string({ message: "Informe o texto da busca" })
      .transform((val) => val.trim())
      .pipe(
        z
          .string()
          .min(2, { message: "A busca precisa ter no mínimo 2 caracteres" }),
      ),
  }),
});
