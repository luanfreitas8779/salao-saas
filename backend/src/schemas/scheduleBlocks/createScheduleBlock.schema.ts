import { z } from "zod";

export const newScheduleBlockSchema = z.object({
  body: z.object({
    start_time: z.string().regex(/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/, {
      message:
        "Formato de horário inválido. Use o padrão HH:MM (00:00 às 23:59).",
    }),
    end_time: z.string().regex(/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/, {
      message:
        "Formato de horário inválido. Use o padrão HH:MM (00:00 às 23:59).",
    }),
    reason: z.string().min(1, { message: "O motivo é obrigatório." }),
  }),
});
