import { describe, expect, it } from "vitest";

import { appointmentAvailabilitySchema } from "./appointmentAvailabilitySchema";
import { appointmentBoardSchema } from "./appointmentBoardSchema";
import { appointmentIdParamSchema } from "./appointmentIdParamSchema";
import { createAppointmentSchema } from "./createAppointmentSchema";
import { updateAppointmentSchema } from "./updateAppointmentSchema";
import { listMyAppointmentsSchema } from "./listMyAppointmentsSchema";

const ID_VALIDO = "3f1c9a52-8c4e-4f7a-9d2b-6a1e5c7b8d90";

describe("appointmentAvailabilitySchema", () => {
  it("aceita procedimento e data válidos na query", () => {
    expect(
      appointmentAvailabilitySchema.safeParse({
        query: { procedure_id: ID_VALIDO, date: "2099-01-05" },
      }).success,
    ).toBe(true);
  });

  it.each([
    ["formato brasileiro", "05/01/2099"],
    ["data inexistente", "2099-02-30"],
    ["data com hora", "2099-01-05T10:00:00Z"],
  ])("recusa data em %s", (_caso, date) => {
    const resultado = appointmentAvailabilitySchema.safeParse({
      query: { procedure_id: ID_VALIDO, date },
    });

    expect(resultado.error?.issues[0]?.message).toBe("Data inválida!");
  });
});

describe("appointmentBoardSchema", () => {
  it("aceita data inicial e final válidas", () => {
    expect(
      appointmentBoardSchema.safeParse({
        query: { start_date: "2099-01-05", end_date: "2099-01-11" },
      }).success,
    ).toBe(true);
  });

  it("aponta qual das duas datas está errada", () => {
    const resultado = appointmentBoardSchema.safeParse({
      query: { start_date: "2099-01-05", end_date: "ontem" },
    });

    expect(resultado.error?.issues.map((issue) => issue.message)).toEqual([
      "Data final inválida",
    ]);
  });
});

describe("appointmentIdParamSchema", () => {
  it.each([
    [ID_VALIDO, true],
    ["123", false],
  ])("id %s → aceito = %s", (id, aceito) => {
    expect(appointmentIdParamSchema.safeParse({ params: { id } }).success).toBe(aceito);
  });
});

describe("createAppointmentSchema", () => {
  const valido = {
    start_time: "2099-01-05T12:00:00.000Z",
    procedure_id: ID_VALIDO,
  };

  it("aceita só início e procedimento (observação e cliente são opcionais)", () => {
    expect(createAppointmentSchema.safeParse({ body: valido }).success).toBe(true);
  });

  it("aceita observação e client_id quando informados", () => {
    expect(
      createAppointmentSchema.safeParse({
        body: { ...valido, observation: "Cabelo longo", client_id: ID_VALIDO },
      }).success,
    ).toBe(true);
  });

  it("recusa início sem horário", () => {
    const resultado = createAppointmentSchema.safeParse({
      body: { ...valido, start_time: "2099-01-05" },
    });

    expect(resultado.error?.issues[0]?.message).toBe("Formato de data inválido");
  });

  it("recusa client_id que não é UUID", () => {
    expect(
      createAppointmentSchema.safeParse({ body: { ...valido, client_id: "cliente" } })
        .success,
    ).toBe(false);
  });
});

describe("updateAppointmentSchema", () => {
  it.each([
    ["só o horário", { start_time: "2099-01-05T12:00:00.000Z" }],
    ["só o procedimento", { procedure_id: ID_VALIDO }],
    ["só a observação", { observation: "Trocar o horário" }],
  ])("aceita %s", (_caso, body) => {
    expect(
      updateAppointmentSchema.safeParse({ params: { id: ID_VALIDO }, body }).success,
    ).toBe(true);
  });

  it("recusa o body vazio", () => {
    const resultado = updateAppointmentSchema.safeParse({
      params: { id: ID_VALIDO },
      body: {},
    });

    expect(resultado.error?.issues[0]?.message).toBe(
      "Informe ao menos um campo para atualizar",
    );
  });
});

describe("appointmentBoardSchema: tamanho do período", () => {
  function aceita(start_date: string, end_date: string) {
    return appointmentBoardSchema.safeParse({ query: { start_date, end_date } }).success;
  }

  it.each([
    ["31 dias (o máximo)", "2099-01-01", "2099-01-31", true],
    ["32 dias", "2099-01-01", "2099-02-01", false],
    ["um dia só", "2099-01-05", "2099-01-05", true],
    ["data final antes da inicial", "2099-01-10", "2099-01-05", false],
  ])("período de %s → aceito = %s", (_caso, inicio, fim, esperado) => {
    expect(aceita(inicio, fim)).toBe(esperado);
  });

  it("explica o motivo quando o período passa de 31 dias", () => {
    const resultado = appointmentBoardSchema.safeParse({
      query: { start_date: "2099-01-01", end_date: "2099-03-01" },
    });

    expect(resultado.error?.issues[0]?.message).toBe(
      "O período pode ter no máximo 31 dias, e a data final não pode ser anterior à inicial",
    );
  });
});

describe("listMyAppointmentsSchema (paginação)", () => {
  it("usa a página 1 com 20 itens quando nada é informado", () => {
    expect(listMyAppointmentsSchema.safeParse({ query: {} }).data?.query).toEqual({
      page: 1,
      limit: 20,
    });
  });

  it("converte page e limit, que chegam como texto na URL", () => {
    expect(
      listMyAppointmentsSchema.safeParse({ query: { page: "3", limit: "50" } }).data?.query,
    ).toEqual({ page: 3, limit: 50 });
  });

  it.each([
    ["page 0", { page: "0" }],
    ["page negativa", { page: "-1" }],
    ["limit 0", { limit: "0" }],
    ["limit acima de 100", { limit: "101" }],
    ["page decimal", { page: "1.5" }],
    ["page que não é número", { page: "abc" }],
  ])("recusa %s", (_caso, query) => {
    expect(listMyAppointmentsSchema.safeParse({ query }).success).toBe(false);
  });
});
