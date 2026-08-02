import { z } from "zod";

export const resetPasswordSchema = z.object({
  params: z.object({
    token: z.string(),
  }),
});
