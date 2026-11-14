import { describe, expect, it } from "vitest";

import { newScheduleBlockSchema } from "./createScheduleBlockSchema";

const valido = {
  start_time: "2099-01-05T11:00:00.000Z",
  end_time: "2099-01-05T21:00:00.000Z",
  reason: "Feriado",
};

function primeiraMensagem(body: Record<string, unknown>) {
  return newScheduleBlockSchema.safeParse({ body }).error?.issues[0]?.message;
}

describe("newScheduleBlockSchema", () => {
  it("aceita um bloqueio válido", () => {
    expect(newScheduleBlockSchema.safeParse({ body: valido }).success).toBe(true);
  });

  it("exige o motivo", () => {
    expect(primeiraMensagem({ ...valido, reason: "" })).toBe("O motivo é obrigatório.");
  });

  it.each([
    ["termina antes de começar", "2099-01-05T10:00:00.000Z"],
    ["termina no mesmo instante em que começa", valido.start_time],
  ])("recusa bloqueio que %s", (_caso, end_time) => {
    expect(primeiraMensagem({ ...valido, end_time })).toBe(
      "O início do bloqueio deve ser anterior ao término.",
    );
  });

  it("recusa data sem horário", () => {
    expect(primeiraMensagem({ ...valido, start_time: "2099-01-05" })).toBe(
      "Formato de data inválido",
    );
  });
});
