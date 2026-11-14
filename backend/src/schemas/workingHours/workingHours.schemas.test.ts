import { describe, expect, it } from "vitest";

import { workingHoursSchema } from "./workingHoursSchema";

const segunda = {
  day: 1,
  start_time: "08:00",
  end_time: "18:00",
  break_start: "12:00",
  break_end: "13:00",
  isOpen: true,
};

function mensagens(newData: unknown[]) {
  const resultado = workingHoursSchema.safeParse({ body: { newData } });
  return resultado.error?.issues.map((issue) => issue.message) ?? [];
}

describe("workingHoursSchema", () => {
  it("aceita um dia com pausa", () => {
    expect(mensagens([segunda])).toEqual([]);
  });

  it("aceita um dia sem pausa (null ou ausente)", () => {
    expect(mensagens([{ ...segunda, break_start: null, break_end: null }])).toEqual([]);
    const { break_start, break_end, ...semPausa } = segunda;
    expect(mensagens([semPausa])).toEqual([]);
  });

  it("recusa a lista vazia", () => {
    expect(mensagens([])).toContain("Informe ao menos um dia.");
  });

  it("recusa dias da semana repetidos", () => {
    expect(mensagens([segunda, { ...segunda }])).toContain("Há dias da semana repetidos.");
  });

  it.each([
    ["dia -1", { day: -1 }],
    ["dia 7", { day: 7 }],
  ])("recusa %s (vai de 0 a 6)", (_caso, mudanca) => {
    expect(mensagens([{ ...segunda, ...mudanca }]).length).toBeGreaterThan(0);
  });

  it.each(["8:00", "24:00", "08:60", "0800"])("recusa o horário %s", (hora) => {
    expect(mensagens([{ ...segunda, start_time: hora }])).toContain(
      "Formato de horário inválido. Use o padrão HH:MM (00:00 às 23:59).",
    );
  });

  it("recusa abertura depois do fechamento", () => {
    expect(mensagens([{ ...segunda, start_time: "18:00", end_time: "08:00" }])).toContain(
      "O horário de abertura deve ser anterior ao de fechamento.",
    );
  });

  it("recusa pausa com só um dos lados", () => {
    expect(mensagens([{ ...segunda, break_end: null }])).toContain(
      "Informe o início e o fim da pausa, ou nenhum dos dois.",
    );
  });

  it.each([
    ["começa antes da abertura", { break_start: "07:00", break_end: "09:00" }],
    ["termina depois do fechamento", { break_start: "17:00", break_end: "19:00" }],
    ["termina antes de começar", { break_start: "13:00", break_end: "12:00" }],
  ])("recusa pausa que %s", (_caso, pausa) => {
    expect(mensagens([{ ...segunda, ...pausa }])).toContain(
      "A pausa deve estar dentro do expediente.",
    );
  });
});
