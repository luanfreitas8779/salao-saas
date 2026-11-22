import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// O validateEnvSchema valida as variáveis NO MOMENTO DO IMPORT (é o que impede
// o servidor de subir com variável faltando). Por isso cada teste:
//   1. ajusta as variáveis com vi.stubEnv;
//   2. limpa o cache de módulos (vi.resetModules);
//   3. importa o arquivo de novo (vi.importActual, com await).

// O arquivo carrega o .env de verdade com "dotenv/config". Se não fosse trocado,
// as variáveis do seu .env preencheriam as que o teste apagou de propósito.
vi.mock("dotenv/config", () => ({}));

const VALIDAS = {
  DATABASE_URL: "postgresql://u:s@localhost:5432/salaoregina",
  EMAIL_USER: "salao@email.com",
  EMAIL_PASS: "senha",
  JWT_SECRET: "segredo",
  FRONTEND_URL: "http://localhost:5173",
};

function definirVariaveis(variaveis: Record<string, string | undefined>) {
  for (const [nome, valor] of Object.entries(variaveis)) {
    vi.stubEnv(nome, valor);
  }
}

async function importarEnv() {
  vi.resetModules();
  return vi.importActual<typeof import("./validateEnvSchema")>("./validateEnvSchema");
}

beforeEach(() => {
  // o arquivo imprime o erro no console quando a validação falha; silencia no teste
  vi.spyOn(console, "error").mockImplementation(() => {});
  definirVariaveis({ ...VALIDAS, PORT: undefined });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("validateEnvSchema", () => {
  it("expõe as variáveis quando todas estão presentes", async () => {
    const { env } = await importarEnv();

    expect(env).toMatchObject(VALIDAS);
  });

  it("usa a porta 3333 quando PORT não é informada", async () => {
    const { env } = await importarEnv();

    expect(env.PORT).toBe(3333);
  });

  it("converte PORT de texto para número", async () => {
    definirVariaveis({ PORT: "8080" });

    const { env } = await importarEnv();

    expect(env.PORT).toBe(8080);
  });

  it.each(Object.keys(VALIDAS))("impede a aplicação de subir quando falta %s", async (nome) => {
    definirVariaveis({ [nome]: undefined });

    await expect(importarEnv()).rejects.toThrow("TA FALTANDO VARIAVEL!");
  });

  it("recusa FRONTEND_URL que não é uma URL", async () => {
    definirVariaveis({ FRONTEND_URL: "localhost" });

    await expect(importarEnv()).rejects.toThrow("TA FALTANDO VARIAVEL!");
  });
});
