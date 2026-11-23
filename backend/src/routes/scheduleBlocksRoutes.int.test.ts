import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { api, autorizacao, criarProf, criarCliente } from "../../test-integration/api";
import {
  criarProcedimento,
  limparBanco,
  prismaClient,
} from "../../test-integration/database";

// Teste de API: requisições HTTP de verdade em /api/schedule-blocks, até o banco de teste.

let cliente: Awaited<ReturnType<typeof criarCliente>>;
let admin: Awaited<ReturnType<typeof criarProf>>;

const bloqueio = {
  start_time: "2099-01-05T11:00:00.000Z",
  end_time: "2099-01-05T21:00:00.000Z",
  reason: "Feriado",
};

beforeEach(async () => {
  await limparBanco();
  cliente = await criarCliente();
  admin = await criarProf();
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
    expect(res.body).toMatchObject({ reason: "Feriado" });
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

describe("GET /api/schedule-blocks", () => {
  it("o admin lista os bloqueios do período", async () => {
    await api().post("/api/schedule-blocks").set("Authorization", autorizacao(admin)).send(bloqueio);

    const res = await api()
      .get("/api/schedule-blocks")
      .set("Authorization", autorizacao(admin))
      .query({ start_date: "2099-01-05", end_date: "2099-01-05" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ reason: "Feriado" });
  });

  it("o cliente recebe 403", async () => {
    const res = await api()
      .get("/api/schedule-blocks")
      .set("Authorization", autorizacao(cliente))
      .query({ start_date: "2099-01-05", end_date: "2099-01-05" });

    expect(res.status).toBe(403);
  });

  it("responde 400 sem o período na query", async () => {
    const res = await api().get("/api/schedule-blocks").set("Authorization", autorizacao(admin));

    expect(res.status).toBe(400);
  });
});

describe("PUT /api/schedule-blocks/:id", () => {
  async function criarBloqueio() {
    const res = await api()
      .post("/api/schedule-blocks")
      .set("Authorization", autorizacao(admin))
      .send(bloqueio);
    return res.body as { id: string };
  }

  it("o admin edita o bloqueio (200), inclusive mantendo o mesmo período", async () => {
    const criado = await criarBloqueio();

    const res = await api()
      .put(`/api/schedule-blocks/${criado.id}`)
      .set("Authorization", autorizacao(admin))
      .send({ ...bloqueio, reason: "Reforma" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: criado.id, reason: "Reforma" });
  });

  it("responde 400 quando o novo período bate com um agendamento", async () => {
    const criado = await criarBloqueio();
    const procedimento = await criarProcedimento();
    await prismaClient.appointments.create({
      data: {
        client_id: cliente.id,
        procedure_id: procedimento.id,
        start_time: new Date("2099-01-06T12:00:00.000Z"),
        end_time: new Date("2099-01-06T13:00:00.000Z"),
      },
    });

    const res = await api()
      .put(`/api/schedule-blocks/${criado.id}`)
      .set("Authorization", autorizacao(admin))
      .send({
        ...bloqueio,
        start_time: "2099-01-06T11:00:00.000Z",
        end_time: "2099-01-06T21:00:00.000Z",
      });

    expect(res.status).toBe(400);
  });

  it("responde 404 para um bloqueio que não existe", async () => {
    const res = await api()
      .put("/api/schedule-blocks/3f1c9a52-8c4e-4f7a-9d2b-6a1e5c7b8d90")
      .set("Authorization", autorizacao(admin))
      .send(bloqueio);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: "Bloqueio não encontrado" });
  });

  it("o cliente recebe 403", async () => {
    const criado = await criarBloqueio();

    const res = await api()
      .put(`/api/schedule-blocks/${criado.id}`)
      .set("Authorization", autorizacao(cliente))
      .send(bloqueio);

    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/schedule-blocks/:id", () => {
  it("o admin remove o bloqueio e o horário volta a ficar livre para outro bloqueio", async () => {
    const criado = await api()
      .post("/api/schedule-blocks")
      .set("Authorization", autorizacao(admin))
      .send(bloqueio);

    const remove = await api()
      .delete(`/api/schedule-blocks/${criado.body.id}`)
      .set("Authorization", autorizacao(admin));
    const denovo = await api()
      .post("/api/schedule-blocks")
      .set("Authorization", autorizacao(admin))
      .send(bloqueio);

    expect(remove.status).toBe(200);
    expect(denovo.status).toBe(201);
  });

  it("o cliente recebe 403 e o bloqueio continua", async () => {
    const criado = await api()
      .post("/api/schedule-blocks")
      .set("Authorization", autorizacao(admin))
      .send(bloqueio);

    const res = await api()
      .delete(`/api/schedule-blocks/${criado.body.id}`)
      .set("Authorization", autorizacao(cliente));

    expect(res.status).toBe(403);
    expect(await prismaClient.schedule_blocks.count()).toBe(1);
  });

  it("responde 404 para um bloqueio que não existe", async () => {
    const res = await api()
      .delete("/api/schedule-blocks/3f1c9a52-8c4e-4f7a-9d2b-6a1e5c7b8d90")
      .set("Authorization", autorizacao(admin));

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: "Bloqueio não encontrado" });
  });
});
