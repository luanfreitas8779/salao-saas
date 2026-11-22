import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { api, autorizacao, criarAdmin, criarCliente } from "../../test-integration/api";
import {
  criarProcedimento,
  limparBanco,
  prismaClient,
} from "../../test-integration/database";

// Teste de API: requisições HTTP de verdade em /api/schedule-blocks, até o banco de teste.

let cliente: Awaited<ReturnType<typeof criarCliente>>;
let admin: Awaited<ReturnType<typeof criarAdmin>>;

const bloqueio = {
  start_time: "2099-01-05T11:00:00.000Z",
  end_time: "2099-01-05T21:00:00.000Z",
  reason: "Feriado",
};

beforeEach(async () => {
  await limparBanco();
  cliente = await criarCliente();
  admin = await criarAdmin();
});

afterAll(async () => {
  await prismaClient.$disconnect();
});

describe("POST /api/schedule-blocks", () => {
  it("o admin cria o bloqueio (201)", async () => {
    const res = await api()
      .post("/api/schedule-blocks")
      .set("Authorization", autorizacao(admin))
      .send(bloqueio);

    expect(res.status).toBe(201);
    expect(res.body.result).toMatchObject({ reason: "Feriado" });
  });

  it("o cliente recebe 403 e nada é criado", async () => {
    const res = await api()
      .post("/api/schedule-blocks")
      .set("Authorization", autorizacao(cliente))
      .send(bloqueio);

    expect(res.status).toBe(403);
    expect(await prismaClient.schedule_blocks.count()).toBe(0);
  });

  it("responde 400 quando já existe agendamento no período", async () => {
    const procedimento = await criarProcedimento();
    await prismaClient.appointments.create({
      data: {
        client_id: cliente.id,
        procedure_id: procedimento.id,
        start_time: new Date("2099-01-05T12:00:00.000Z"),
        end_time: new Date("2099-01-05T13:00:00.000Z"),
      },
    });

    const res = await api()
      .post("/api/schedule-blocks")
      .set("Authorization", autorizacao(admin))
      .send(bloqueio);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      "Já existe algum bloqueio ou agendamento para a data selecionada.",
    );
  });

  it("responde 400 quando o fim vem antes do início", async () => {
    const res = await api()
      .post("/api/schedule-blocks")
      .set("Authorization", autorizacao(admin))
      .send({ ...bloqueio, end_time: "2099-01-05T10:00:00.000Z" });

    expect(res.status).toBe(400);
  });
});
