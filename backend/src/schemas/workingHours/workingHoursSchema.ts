import { z } from "zod";

export const workingHoursSchema = z.object({
  body: z.object({
    dayOfWeek: z.number().min(0).max(6),
    start_time: z.string().regex(/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/, {
      message:
        "Formato de horário inválido. Use o padrão HH:MM (00:00 às 23:59).",
    }),
    end_time: z.string().regex(/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/, {
      message:
        "Formato de horário inválido. Use o padrão HH:MM (00:00 às 23:59).",
    }),
    break_start: z.string().regex(/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/, {
      message:
        "Formato de horário inválido. Use o padrão HH:MM (00:00 às 23:59).",
    }),
    break_end: z.string().regex(/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/, {
      message:
        "Formato de horário inválido. Use o padrão HH:MM (00:00 às 23:59).",
    }),
    isOpen: z.boolean(),
  }),
});
