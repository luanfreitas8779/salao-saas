import { z } from "zod";

export const deleteProcedureSchema = z.object({
  params: z.object({
    id: z.uuid(),
  }),
});
