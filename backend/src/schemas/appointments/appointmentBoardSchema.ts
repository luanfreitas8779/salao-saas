import { z } from "zod";

export const appointmentBoardSchema = z.object({
  query: z.object({
    start_date: z.iso.date("Data inicial inválida"),
    end_date: z.iso.date("Data final inválida"),
  }),
});
