import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { api, autorizacao, criarProf, criarCliente } from "../../test-integration/api";
import { limparBanco, prismaClient } from "../../test-integration/database";

// Teste de API: requisições HTTP de verdade em /api/users, até o banco de teste.

let cliente: Awaited<ReturnType<typeof criarCliente>>;

beforeEach(async () => {
  await limparBanco();
  cliente = await criarCliente();
});

afterAll(async () => {
  await prismaClient.$disconnect();
});

describe("GET /api/users/profile", () => {
  it("responde 401 sem token", async () => {
    const res = await api().get("/api/users/profile");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: "Token não informado" });
  });

  it("responde 401 com token inválido", async () => {
    const res = await api()
      .get("/api/users/profile")
      .set("Authorization", "Bearer token-falso");

    expect(res.status).toBe(401);
  });

  it("devolve o perfil de quem está logado, sem o password_hash", async () => {
    const res = await api().get("/api/users/profile").set("Authorization", autorizacao(cliente));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: cliente.id, email: cliente.email });
    expect(res.body).not.toHaveProperty("password_hash");
    expect(res.body).not.toHaveProperty("token_version");
  });
});

describe("PATCH /api/users/profile", () => {
  it("atualiza o telefone já limpo e devolve sem o password_hash", async () => {
    const res = await api()
      .patch("/api/users/profile")
      .set("Authorization", autorizacao(cliente))
      .send({ phone: "(11) 98888-7777" });

    expect(res.status).toBe(200);
    expect(res.body.phone).toBe("11988887777");
    expect(res.body).not.toHaveProperty("password_hash");
  });

  it("responde 400 quando o body não tem telefone nem senha", async () => {
    const res = await api()
      .patch("/api/users/profile")
      .set("Authorization", autorizacao(cliente))
      .send({});

    expect(res.status).toBe(400);
  });

  it("responde 409 quando o telefone é de outro usuário", async () => {
    const outro = await criarCliente();

    const res = await api()
      .patch("/api/users/profile")
      .set("Authorization", autorizacao(cliente))
      .send({ phone: outro.phone });

    expect(res.status).toBe(409);
  });
});

describe("GET /api/users?search=", () => {
  it("o admin busca clientes e recebe só os dados públicos", async () => {
    const admin = await criarProf();

    const res = await api()
      .get("/api/users")
      .set("Authorization", autorizacao(admin))
      .query({ search: cliente.email });

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: cliente.id, name: cliente.name, email: cliente.email, phone: cliente.phone },
    ]);
  });

  it("o cliente recebe 403 (não pode ver os dados de outros clientes)", async () => {
    const res = await api()
      .get("/api/users")
      .set("Authorization", autorizacao(cliente))
      .query({ search: "usuario" });

    expect(res.status).toBe(403);
  });

  it("responde 400 com busca de 1 caractere", async () => {
    const admin = await criarProf();

    const res = await api()
      .get("/api/users")
      .set("Authorization", autorizacao(admin))
      .query({ search: "a" });

    expect(res.status).toBe(400);
  });
});
