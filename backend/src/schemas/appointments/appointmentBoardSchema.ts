import { z } from "zod";

const MAX_BOARD_DAYS = 31;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

export const appointmentBoardSchema = z.object({
  query: z
    .object({
      start_date: z.iso.date("Data inicial inválida"),
      end_date: z.iso.date("Data final inválida"),
    })
    //O período é o que limita o tamanho da grade (ela não é paginada):
    //no máximo 31 dias, contando o primeiro e o último
    .refine(
      ({ start_date, end_date }) => {
        const start = Date.parse(start_date);
        const end = Date.parse(end_date);
        //data mal escrita já tem a mensagem do próprio campo: esta regra não opina
        if (Number.isNaN(start) || Number.isNaN(end)) {
          return true;
        }
        const days = (end - start) / DAY_IN_MS + 1;
        return days >= 1 && days <= MAX_BOARD_DAYS;
      },
      {
        message: `O período pode ter no máximo ${MAX_BOARD_DAYS} dias, e a data final não pode ser anterior à inicial`,
      },
    ),
});
