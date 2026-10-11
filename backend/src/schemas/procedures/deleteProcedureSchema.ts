import { z } from "zod";

export const deleteProcedureSchema = z.object({
  body: z.object({
    id: z.string(),
  }),
});
