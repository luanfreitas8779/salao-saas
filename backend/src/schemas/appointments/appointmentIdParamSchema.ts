import { z } from "zod";

export const appointmentIdParamSchema = z.object({
  params: z.object({
    id: z.uuid(),
  }),
});
