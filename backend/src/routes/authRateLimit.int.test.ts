import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../../test-integration/api";
import { limparBanco, prismaClient } from "../../test-integration/database";

// Teste de API do limite de tentativas (rate limiter).
// Fica num arquivo separado de propósito: o limiter guarda as tentativas na
// memória do processo, e o Vitest cria um processo novo para cada arquivo.
// Assim as tentativas daqui não atrapalham os testes de login do authRoutes.

vi.mock("../config/mailer", () => ({ sendMail: vi.fn() }));

beforeEach(async () => {
  await limparBanco();
});

afterAll(async () => {
  await prismaClient.$disconnect();
});

describe("Rate limiter das rotas de autenticação", () => {
  it("login: as 5 primeiras tentativas passam e a 6ª recebe 429", async () => {
    const tentativa = () =>
      api().post("/api/auth/login").send({ email: "maria@email.com", password: "senha123" });

    for (let i = 1; i <= 5; i++) {
      expect((await tentativa()).status).toBe(401); // usuário não existe: chegou na rota
    }

    const sexta = await tentativa();
    expect(sexta.status).toBe(429);
    expect(sexta.body).toEqual({
      message: "Muitas tentativas de login. Tente novamente em 15 minutos.",
    });
  });

  it("recuperação de senha: as 3 primeiras passam e a 4ª recebe 429", async () => {
    const tentativa = () =>
      api().post("/api/auth/recover").send({ email: "maria@email.com" });

    for (let i = 1; i <= 3; i++) {
      expect((await tentativa()).status).toBe(200);
    }

    const quarta = await tentativa();
    expect(quarta.status).toBe(429);
  });
});
