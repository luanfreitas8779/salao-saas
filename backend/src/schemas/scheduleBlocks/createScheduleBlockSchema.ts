import { z } from "zod";

export const newScheduleBlockSchema = z.object({
  body: z
    .object({
      start_time: z.iso.datetime("Formato de data inválido"),
      end_time: z.iso.datetime("Formato de data inválido"),
      reason: z.string().min(1, { message: "O motivo é obrigatório." }),
    })
    .refine((data) => new Date(data.start_time) < new Date(data.end_time), {
      message: "O início do bloqueio deve ser anterior ao término.",
    }),
});
