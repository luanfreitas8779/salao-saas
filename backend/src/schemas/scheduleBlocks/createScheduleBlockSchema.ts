import { z } from "zod";

//Corpo de um bloqueio: o mesmo na criação e na edição
export const scheduleBlockBodySchema = z
  .object({
    start_time: z.iso.datetime("Formato de data inválido"),
    end_time: z.iso.datetime("Formato de data inválido"),
    reason: z.string().min(1, { message: "O motivo é obrigatório." }),
  })
  .refine((data) => new Date(data.start_time) < new Date(data.end_time), {
    message: "O início do bloqueio deve ser anterior ao término.",
  });

export const newScheduleBlockSchema = z.object({
  body: scheduleBlockBodySchema,
});
