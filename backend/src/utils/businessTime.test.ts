import { describe, expect, it } from "vitest";

import {
  businessDateTime,
  businessDayOfWeek,
  fromMinutes,
  nextBusinessDay,
  toBusinessWallClock,
  toMinutes,
} from "./businessTime";

// O salão fica em UTC-3: 08:00 no salão = 11:00 em UTC.

describe("toMinutes / fromMinutes", () => {
  it.each([
    ["00:00", 0],
    ["08:30", 510],
    ["12:00", 720],
    ["23:59", 1439],
  ])("%s equivale a %i minutos desde a meia-noite (ida e volta)", (hora, minutos) => {
    expect(toMinutes(hora)).toBe(minutos);
    expect(fromMinutes(minutos)).toBe(hora);
  });

  it("completa com zero à esquerda horas e minutos de um dígito", () => {
    expect(fromMinutes(65)).toBe("01:05");
  });
});

describe("businessDateTime", () => {
  it("converte data + hora do salão para o instante em UTC", () => {
    expect(businessDateTime("2026-10-12", "08:00").toISOString()).toBe(
      "2026-10-12T11:00:00.000Z",
    );
  });

  it("usa meia-noite do salão quando a hora não é informada", () => {
    expect(businessDateTime("2026-10-12").toISOString()).toBe(
      "2026-10-12T03:00:00.000Z",
    );
  });

  it("um horário da noite no salão já cai no dia seguinte em UTC", () => {
    expect(businessDateTime("2026-10-12", "22:00").toISOString()).toBe(
      "2026-10-13T01:00:00.000Z",
    );
  });
});

describe("nextBusinessDay", () => {
  it("devolve a meia-noite do dia seguinte no salão", () => {
    expect(nextBusinessDay("2026-10-12").toISOString()).toBe(
      "2026-10-13T03:00:00.000Z",
    );
  });

  it("vira o mês e o ano corretamente", () => {
    expect(nextBusinessDay("2026-12-31").toISOString()).toBe(
      "2027-01-01T03:00:00.000Z",
    );
  });
});

describe("businessDayOfWeek", () => {
  it.each([
    ["2026-10-11", 0, "domingo"],
    ["2026-10-12", 1, "segunda"],
    ["2026-10-17", 6, "sábado"],
  ])("%s é dia %i (%s)", (data, dia) => {
    expect(businessDayOfWeek(data)).toBe(dia);
  });
});

describe("toBusinessWallClock", () => {
  it("converte um instante UTC para data e minutos no relógio do salão", () => {
    expect(toBusinessWallClock(new Date("2026-10-12T11:30:00.000Z"))).toEqual({
      date: "2026-10-12",
      minutes: 8 * 60 + 30,
    });
  });

  it("um instante de madrugada em UTC ainda é o dia anterior no salão", () => {
    expect(toBusinessWallClock(new Date("2026-10-13T02:30:00.000Z"))).toEqual({
      date: "2026-10-12",
      minutes: 23 * 60 + 30,
    });
  });

  it("é o inverso do businessDateTime", () => {
    const instante = businessDateTime("2026-10-12", "14:30");

    expect(toBusinessWallClock(instante)).toEqual({
      date: "2026-10-12",
      minutes: toMinutes("14:30"),
    });
  });
});
