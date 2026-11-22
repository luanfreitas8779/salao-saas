import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { api, autorizacao, criarAdmin, criarCliente } from "../../test-integration/api";
import {
  criarProcedimento,
  limparBanco,
  prismaClient,
} from "../../test-integration/database";

// Teste de API: requisições HTTP de verdade em /api/appointments, até o banco de teste.
// Datas fixas em 2099 (segunda-feira): sempre no futuro e sempre a mais de 24h.
// O salão está em UTC-3: 09:00 no salão = 12:00 em UTC.

const DIA = "2099-01-05";
const AS_9H = "2099-01-05T12:00:00.000Z";
const AS_9H30 = "2099-01-05T12:30:00.000Z";
const AS_14H = "2099-01-05T17:00:00.000Z";

let cliente: Awaited<ReturnType<typeof criarCliente>>;
let outroCliente: Awaited<ReturnType<typeof criarCliente>>;
let admin: Awaited<ReturnType<typeof criarAdmin>>;
let procedimentoId: string;

function agendar(usuario: { id: string; role: string }, corpo: Record<string, unknown>) {
  return api()
    .post("/api/appointments")
    .set("Authorization", autorizacao(usuario))
    .send({ procedure_id: procedimentoId, ...corpo });
}

beforeEach(async () => {
  await limparBanco();
  cliente = await criarCliente();
  outroCliente = await criarCliente();
  admin = await criarAdmin();
  procedimentoId = (await criarProcedimento({ duration_minutes: 60 })).id;
  // segunda-feira: 08:00–18:00, pausa 12:00–13:00
  await prismaClient.workingHours.create({
    data: {
      dayOfWeek: 1,
      start_time: "08:00",
      end_time: "18:00",
      break_start: "12:00",
      break_end: "13:00",
      isOpen: true,
    },
  });
});

afterAll(async () => {
  await prismaClient.$disconnect();
});

describe("GET /api/appointments/slots", () => {
  it("exige login (401)", async () => {
    const res = await api().get("/api/appointments/slots").query({ procedure_id: procedimentoId, date: DIA });

    expect(res.status).toBe(401);
  });

  it("lista os horários livres e tira o horário que acabou de ser agendado", async () => {
    const antes = await api()
      .get("/api/appointments/slots")
      .set("Authorization", autorizacao(cliente))
      .query({ procedure_id: procedimentoId, date: DIA });
    await agendar(cliente, { start_time: AS_9H });
    const depois = await api()
      .get("/api/appointments/slots")
      .set("Authorization", autorizacao(cliente))
      .query({ procedure_id: procedimentoId, date: DIA });

    expect(antes.status).toBe(200);
    expect(antes.body).toContain("09:00");
    expect(antes.body).not.toContain("12:00"); // pausa
    expect(depois.body).not.toContain("09:00");
    expect(depois.body).not.toContain("08:30"); // 08:30–09:30 bate no agendamento
  });

  it("responde 400 com data inválida", async () => {
    const res = await api()
      .get("/api/appointments/slots")
      .set("Authorization", autorizacao(cliente))
      .query({ procedure_id: procedimentoId, date: "05/01/2099" });

    expect(res.status).toBe(400);
  });
});

describe("POST /api/appointments", () => {
  it("o cliente agenda para si mesmo (201)", async () => {
    const res = await agendar(cliente, { start_time: AS_9H, observation: "Cabelo longo" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ client_id: cliente.id, status: "SCHEDULED" });
  });

  it("responde 409 quando outro cliente tenta um horário que se sobrepõe", async () => {
    await agendar(cliente, { start_time: AS_9H });

    const res = await agendar(outroCliente, { start_time: AS_9H30 });

    expect(res.status).toBe(409);
  });

  it("de duas requisições sobrepostas ao mesmo tempo, uma recebe 201 e a outra 409", async () => {
    const [a, b] = await Promise.all([
      agendar(cliente, { start_time: AS_9H }),
      agendar(outroCliente, { start_time: AS_9H30 }),
    ]);

    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect(await prismaClient.appointments.count()).toBe(1);
  });

  it("o cliente não agenda em nome de outra pessoa (403)", async () => {
    const res = await agendar(cliente, { start_time: AS_9H, client_id: outroCliente.id });

    expect(res.status).toBe(403);
  });

  it("o admin agenda para um cliente e o agendamento fica no nome do cliente", async () => {
    const res = await agendar(admin, { start_time: AS_9H, client_id: cliente.id });

    expect(res.status).toBe(201);
    expect(res.body.client_id).toBe(cliente.id);
  });

  it("responde 400 para horário dentro da pausa", async () => {
    const res = await agendar(cliente, { start_time: "2099-01-05T15:00:00.000Z" }); // 12:00 no salão

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Horário conflita com a pausa do salão.");
  });
});

describe("GET /api/appointments/me e /board", () => {
  it("/me lista só os agendamentos de quem está logado", async () => {
    await agendar(cliente, { start_time: AS_9H });
    await agendar(outroCliente, { start_time: AS_14H });

    const res = await api().get("/api/appointments/me").set("Authorization", autorizacao(cliente));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].client_id).toBe(cliente.id);
  });

  it("/board é só para o admin", async () => {
    await agendar(cliente, { start_time: AS_9H });
    const periodo = { start_date: DIA, end_date: DIA };

    const comoCliente = await api()
      .get("/api/appointments/board")
      .set("Authorization", autorizacao(cliente))
      .query(periodo);
    const comoAdmin = await api()
      .get("/api/appointments/board")
      .set("Authorization", autorizacao(admin))
      .query(periodo);

    expect(comoCliente.status).toBe(403);
    expect(comoAdmin.status).toBe(200);
    expect(comoAdmin.body).toHaveLength(1);
  });
});

describe("PATCH /api/appointments/:id/cancel e PATCH /api/appointments/:id", () => {
  it("o cliente cancela o próprio agendamento e o horário volta a ficar livre", async () => {
    const criado = await agendar(cliente, { start_time: AS_9H });

    const cancela = await api()
      .patch(`/api/appointments/${criado.body.id}/cancel`)
      .set("Authorization", autorizacao(cliente));
    const novo = await agendar(outroCliente, { start_time: AS_9H });

    expect(cancela.status).toBe(200);
    expect(cancela.body.status).toBe("CANCELLED");
    expect(novo.status).toBe(201);
  });

  it("um cliente não cancela nem edita o agendamento de outro (403)", async () => {
    const criado = await agendar(cliente, { start_time: AS_9H });

    const cancela = await api()
      .patch(`/api/appointments/${criado.body.id}/cancel`)
      .set("Authorization", autorizacao(outroCliente));
    const edita = await api()
      .patch(`/api/appointments/${criado.body.id}`)
      .set("Authorization", autorizacao(outroCliente))
      .send({ observation: "invadindo" });

    expect(cancela.status).toBe(403);
    expect(edita.status).toBe(403);
  });

  it("o cliente move o próprio agendamento para outro horário livre (200)", async () => {
    const criado = await agendar(cliente, { start_time: AS_9H });

    const res = await api()
      .patch(`/api/appointments/${criado.body.id}`)
      .set("Authorization", autorizacao(cliente))
      .send({ start_time: AS_14H });

    expect(res.status).toBe(200);
    expect(res.body.start_time).toBe(AS_14H);
  });

  it("responde 409 ao mover para cima de outro agendamento", async () => {
    const meu = await agendar(cliente, { start_time: AS_9H });
    await agendar(outroCliente, { start_time: AS_14H });

    const res = await api()
      .patch(`/api/appointments/${meu.body.id}`)
      .set("Authorization", autorizacao(cliente))
      .send({ start_time: AS_14H });

    expect(res.status).toBe(409);
  });

  it("responde 400 para um id que não é UUID", async () => {
    const res = await api()
      .patch("/api/appointments/123/cancel")
      .set("Authorization", autorizacao(cliente));

    expect(res.status).toBe(400);
  });
});
