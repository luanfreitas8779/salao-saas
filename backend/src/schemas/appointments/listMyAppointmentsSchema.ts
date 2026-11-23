import { z } from "zod";

//Paginação por offset: page começa em 1. Os valores chegam como texto na URL
//(?page=2&limit=20), por isso o coerce converte para número.
export const listMyAppointmentsSchema = z.object({
  query: z.object({
    page: z.coerce
      .number({ message: "A página precisa ser um número" })
      .int({ message: "A página precisa ser um número inteiro" })
      .min(1, { message: "A página começa em 1" })
      .default(1),
    limit: z.coerce
      .number({ message: "O limite precisa ser um número" })
      .int({ message: "O limite precisa ser um número inteiro" })
      .min(1, { message: "O limite precisa ser de no mínimo 1" })
      .max(100, { message: "O limite pode ser de no máximo 100" })
      .default(20),
  }),
});
