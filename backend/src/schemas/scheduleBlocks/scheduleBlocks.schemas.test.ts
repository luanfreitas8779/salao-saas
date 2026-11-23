import { describe, expect, it } from "vitest";

import { newScheduleBlockSchema } from "./createScheduleBlockSchema";
import { listScheduleBlocksSchema } from "./listScheduleBlocksSchema";
import { updateScheduleBlockSchema } from "./updateScheduleBlockSchema";
import { scheduleBlockIdParamSchema } from "./scheduleBlockIdParamSchema";

const ID_VALIDO = "3f1c9a52-8c4e-4f7a-9d2b-6a1e5c7b8d90";

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

describe("listScheduleBlocksSchema", () => {
  it("aceita data inicial e final válidas na query", () => {
    expect(
      listScheduleBlocksSchema.safeParse({
        query: { start_date: "2099-01-05", end_date: "2099-01-11" },
      }).success,
    ).toBe(true);
  });

  it("recusa data em outro formato", () => {
    expect(
      listScheduleBlocksSchema.safeParse({
        query: { start_date: "05/01/2099", end_date: "2099-01-11" },
      }).success,
    ).toBe(false);
  });
});

describe("updateScheduleBlockSchema", () => {
  it("aceita id válido na URL e um bloqueio válido no body", () => {
    expect(
      updateScheduleBlockSchema.safeParse({ params: { id: ID_VALIDO }, body: valido }).success,
    ).toBe(true);
  });

  it("recusa id que não é UUID", () => {
    expect(
      updateScheduleBlockSchema.safeParse({ params: { id: "123" }, body: valido }).success,
    ).toBe(false);
  });

  it("aplica as mesmas regras da criação: o início vem antes do fim", () => {
    const resultado = updateScheduleBlockSchema.safeParse({
      params: { id: ID_VALIDO },
      body: { ...valido, end_time: valido.start_time },
    });

    expect(resultado.error?.issues[0]?.message).toBe(
      "O início do bloqueio deve ser anterior ao término.",
    );
  });
});

describe("scheduleBlockIdParamSchema", () => {
  it.each([
    [ID_VALIDO, true],
    ["nao-e-uuid", false],
  ])("id %s → aceito = %s", (id, aceito) => {
    expect(scheduleBlockIdParamSchema.safeParse({ params: { id } }).success).toBe(aceito);
  });
});
