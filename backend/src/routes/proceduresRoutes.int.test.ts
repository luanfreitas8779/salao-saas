import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { api, autorizacao, criarProf, criarCliente } from "../../test-integration/api";
import {
  criarProcedimento,
  limparBanco,
  prismaClient,
} from "../../test-integration/database";

// Teste de API: requisições HTTP de verdade em /api/procedures, até o banco de teste.
// O mais importante aqui é a PERMISSÃO: só o admin cria, edita e remove.
// Se alguém tirar o isProf de uma rota, estes testes ficam vermelhos.

let cliente: Awaited<ReturnType<typeof criarCliente>>;
let admin: Awaited<ReturnType<typeof criarProf>>;

const novo = {
  name: "Corte feminino",
  description: "Corte com lavagem",
  price: 8000,
  duration_minutes: 60,
};

beforeEach(async () => {
  await limparBanco();
  cliente = await criarCliente();
  admin = await criarProf();
});

afterAll(async () => {
  await prismaClient.$disconnect();
});

describe("GET /api/procedures e GET /api/procedures/all", () => {
  it("a lista pública não exige login e traz só os ativos", async () => {
    const ativo = await criarProcedimento({ name: "Ativo" });
    await criarProcedimento({ name: "Inativo", is_active: false });

    const res = await api().get("/api/procedures");

    expect(res.status).toBe(200);
    expect(res.body.map((p: { id: string }) => p.id)).toEqual([ativo.id]);
  });

  it("a lista completa (com inativos) é só para o admin", async () => {
    await criarProcedimento({ is_active: false });

    const semLogin = await api().get("/api/procedures/all");
    const comoCliente = await api().get("/api/procedures/all").set("Authorization", autorizacao(cliente));
    const comoAdmin = await api().get("/api/procedures/all").set("Authorization", autorizacao(admin));

    expect(semLogin.status).toBe(401);
    expect(comoCliente.status).toBe(403);
    expect(comoAdmin.status).toBe(200);
    expect(comoAdmin.body).toHaveLength(1);
  });
});

describe("POST /api/procedures", () => {
  it("o admin cria (201)", async () => {
    const res = await api()
      .post("/api/procedures")
      .set("Authorization", autorizacao(admin))
      .send(novo);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject(novo);
  });

  it("o cliente recebe 403 e nada é criado", async () => {
    const res = await api()
      .post("/api/procedures")
      .set("Authorization", autorizacao(cliente))
      .send(novo);

    expect(res.status).toBe(403);
    expect(await prismaClient.procedures.count()).toBe(0);
  });

  it("a permissão é conferida antes da validação: cliente com body inválido recebe 403, não 400", async () => {
    const res = await api()
      .post("/api/procedures")
      .set("Authorization", autorizacao(cliente))
      .send({ name: "" });

    expect(res.status).toBe(403);
  });

  it("o admin recebe 400 com preço abaixo do mínimo", async () => {
    const res = await api()
      .post("/api/procedures")
      .set("Authorization", autorizacao(admin))
      .send({ ...novo, price: 100 });

    expect(res.status).toBe(400);
    expect(res.body.details[0].campo).toBe("price");
  });

  it("o admin recebe 409 com nome repetido", async () => {
    await criarProcedimento({ name: novo.name });

    const res = await api()
      .post("/api/procedures")
      .set("Authorization", autorizacao(admin))
      .send(novo);

    expect(res.status).toBe(409);
  });
});

describe("PUT e DELETE /api/procedures/:id", () => {
  it("o admin edita (200)", async () => {
    const procedimento = await criarProcedimento();

    const res = await api()
      .put(`/api/procedures/${procedimento.id}`)
      .set("Authorization", autorizacao(admin))
      .send({ ...novo, price: 9000 });

    expect(res.status).toBe(200);
    expect(res.body.price).toBe(9000);
  });

  it("responde 404 para um id que não existe", async () => {
    const res = await api()
      .put("/api/procedures/3f1c9a52-8c4e-4f7a-9d2b-6a1e5c7b8d90")
      .set("Authorization", autorizacao(admin))
      .send(novo);

    expect(res.status).toBe(404);
  });

  it("responde 400 para um id que não é UUID", async () => {
    const res = await api()
      .delete("/api/procedures/123")
      .set("Authorization", autorizacao(admin));

    expect(res.status).toBe(400);
  });

  it("o admin remove: o procedimento sai da lista pública mas continua no banco", async () => {
    const procedimento = await criarProcedimento();

    const res = await api()
      .delete(`/api/procedures/${procedimento.id}`)
      .set("Authorization", autorizacao(admin));
    const publica = await api().get("/api/procedures");

    expect(res.status).toBe(200);
    expect(publica.body).toEqual([]);
    expect(await prismaClient.procedures.count()).toBe(1);
  });

  it("o cliente não edita nem remove (403)", async () => {
    const procedimento = await criarProcedimento();

    const edita = await api()
      .put(`/api/procedures/${procedimento.id}`)
      .set("Authorization", autorizacao(cliente))
      .send(novo);
    const remove = await api()
      .delete(`/api/procedures/${procedimento.id}`)
      .set("Authorization", autorizacao(cliente));

    expect(edita.status).toBe(403);
    expect(remove.status).toBe(403);
  });
});
