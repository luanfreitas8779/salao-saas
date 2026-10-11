import { z } from "zod";

export const updateAppointmentSchema = z.object({
  params: z.object({
    id: z.uuid(),
  }),
  body: z
    .object({
      start_time: z.iso.datetime("Formato de data inválido").optional(),
      procedure_id: z.uuid().optional(),
      observation: z.string().optional(),
    })
    .refine(
      (data) =>
        data.start_time !== undefined ||
        data.procedure_id !== undefined ||
        data.observation !== undefined,
      { message: "Informe ao menos um campo para atualizar" },
    ),
});
