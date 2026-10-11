import { z } from "zod";

const timeSchema = z.string().regex(/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/, {
  message: "Formato de horário inválido. Use o padrão HH:MM (00:00 às 23:59).",
});

const dayWorkingHoursSchema = z
  .object({
    day: z.number().int().min(0).max(6),
    start_time: timeSchema,
    end_time: timeSchema,
    break_start: timeSchema.nullable().optional(),
    break_end: timeSchema.nullable().optional(),
    isOpen: z.boolean(),
  })
  .refine((data) => data.start_time < data.end_time, {
    message: "O horário de abertura deve ser anterior ao de fechamento.",
  })
  .refine((data) => !!data.break_start === !!data.break_end, {
    message: "Informe o início e o fim da pausa, ou nenhum dos dois.",
  })
  .refine(
    (data) =>
      !data.break_start ||
      !data.break_end ||
      (data.break_start < data.break_end &&
        data.break_start >= data.start_time &&
        data.break_end <= data.end_time),
    { message: "A pausa deve estar dentro do expediente." },
  );

export const workingHoursSchema = z.object({
  body: z.object({
    newData: z
      .array(dayWorkingHoursSchema)
      .min(1, { message: "Informe ao menos um dia." })
      .refine((days) => new Set(days.map((d) => d.day)).size === days.length, {
        message: "Há dias da semana repetidos.",
      }),
  }),
});
