import { z } from "zod";
import { scheduleBlockBodySchema } from "./createScheduleBlockSchema";

export const updateScheduleBlockSchema = z.object({
  params: z.object({
    id: z.uuid(),
  }),
  body: scheduleBlockBodySchema,
});
