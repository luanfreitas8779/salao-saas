import { z } from "zod";

export const createAppointmentSchema = z.object({
  body: z.object({
    start_time: z.iso.datetime("Formato de data inválido"),
    observation: z.string().optional(),
    procedure_id: z.uuid(),
  }),
});
