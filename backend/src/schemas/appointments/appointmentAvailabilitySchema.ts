import { z } from "zod";

export const appointmentAvailabilitySchema = z.object({
  body: {
    day: z.iso.datetime("Data inválida!"),
    duration_time: z.number().min(30).max(360),
  },
});
