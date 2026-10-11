import { z } from "zod";

export const appointmentAvailabilitySchema = z.object({
  query: z.object({
    procedure_id: z.uuid(),
    date: z.iso.date("Data inválida!"),
  }),
});
