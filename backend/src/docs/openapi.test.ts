import { describe, expect, it } from "vitest";
import request from "supertest";

import { app, apiRoutes } from "../app";
import { openApiDocument } from "./openapi";

// A documentação (Swagger/OpenAPI) é comparada com as rotas REAIS do Express.
// Se alguém criar, remover ou proteger uma rota sem atualizar a documentação,
// estes testes ficam vermelhos.

type Metodo = "get" | "post" | "put" | "patch" | "delete";

interface RotaReal {
  chave: string; // ex.: "post /api/procedures"
  middlewares: string[]; // nomes das funções da rota, ex.: ["isAuthenticated", "isProf"]
}

// "/:id/cancel" no Express vira "/{id}/cancel" no OpenAPI
function paraOpenApi(caminho: string) {
  return caminho.replace(/:(\w+)/g, "{$1}").replace(/\/$/, "");
}

function rotasReais(): RotaReal[] {
  return apiRoutes.flatMap(([prefixo, router]) =>
    (router as unknown as { stack: { route?: { path: string; methods: Record<string, boolean>; stack: { name: string }[] } }[] }).stack
      .filter((layer) => layer.route)
      .flatMap((layer) =>
        Object.keys(layer.route!.methods).map((metodo) => ({
          chave: `${metodo} ${paraOpenApi(prefixo + layer.route!.path)}`,
          middlewares: layer.route!.stack.map((handler) => handler.name),
        })),
      ),
  );
}

function operacao(chave: string) {
  const [metodo, caminho] = chave.split(" ") as [Metodo, string];
  return openApiDocument.paths[caminho]?.[metodo];
}

function rotasDocumentadas() {
  return Object.entries(openApiDocument.paths).flatMap(([caminho, operacoes]) =>
    Object.keys(operacoes).map((metodo) => `${metodo} ${caminho}`),
  );
}

describe("Documentação OpenAPI", () => {
  it("documenta todas as rotas da API, e só elas", () => {
    const reais = rotasReais().map((rota) => rota.chave).sort();

    expect(rotasDocumentadas().sort()).toEqual(reais);
  });

  it("pede token exatamente nas rotas que usam o isAuthenticated", () => {
    for (const rota of rotasReais()) {
      // isAuthenticated ou a variação isAuthenticatedAllowingPasswordChange
      const exigeLogin = rota.middlewares.some((nome) => nome.startsWith("isAuthenticated"));
      const documentadaComToken = (operacao(rota.chave)?.security ?? []).length > 0;

      expect({ rota: rota.chave, documentadaComToken }).toEqual({
        rota: rota.chave,
        documentadaComToken: exigeLogin,
      });
    }
  });

  it("as rotas de admin documentam o 403 e as autenticadas documentam o 401", () => {
    for (const rota of rotasReais()) {
      const respostas = Object.keys(operacao(rota.chave)?.responses ?? {});

      if (rota.middlewares.includes("isProf")) {
        expect({ rota: rota.chave, tem403: respostas.includes("403") }).toEqual({
          rota: rota.chave,
          tem403: true,
        });
      }
      if (rota.middlewares.some((nome) => nome.startsWith("isAuthenticated"))) {
        expect({ rota: rota.chave, tem401: respostas.includes("401") }).toEqual({
          rota: rota.chave,
          tem401: true,
        });
      }
    }
  });

  it("toda operação documenta ao menos uma resposta de sucesso", () => {
    for (const chave of rotasDocumentadas()) {
      const sucessos = Object.keys(operacao(chave)?.responses ?? {}).filter((status) =>
        status.startsWith("2"),
      );

      expect({ rota: chave, temSucesso: sucessos.length > 0 }).toEqual({
        rota: chave,
        temSucesso: true,
      });
    }
  });

  it("o corpo das requisições vem dos schemas do Zod (preço em centavos, mínimo 500)", () => {
    const corpo = operacao("post /api/procedures")?.requestBody?.content["application/json"]?.schema;

    expect(corpo).toMatchObject({
      type: "object",
      required: expect.arrayContaining(["name", "description", "price", "duration_minutes"]),
      properties: { price: { type: "integer", minimum: 500 } },
    });
  });

  it("os campos que o Zod transforma aparecem como o cliente envia (telefone como texto)", () => {
    const corpo = operacao("post /api/auth/register")?.requestBody?.content["application/json"]?.schema;

    expect(corpo).toMatchObject({ properties: { phone: { type: "string" } } });
  });

  it("documenta os parâmetros de query e de rota", () => {
    const slots = operacao("get /api/appointments/slots")?.parameters ?? [];
    const cancelar = operacao("patch /api/appointments/{id}/cancel")?.parameters ?? [];

    expect(slots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "procedure_id", in: "query", required: true }),
        expect.objectContaining({ name: "date", in: "query", required: true }),
      ]),
    );
    expect(cancelar).toEqual([
      expect.objectContaining({ name: "id", in: "path", required: true }),
    ]);
  });
});

describe("Rotas da documentação", () => {
  it("GET /api/docs.json devolve o documento OpenAPI", async () => {
    const res = await request(app).get("/api/docs.json");

    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe("3.1.0");
    expect(res.body.paths["/api/procedures"]).toBeDefined();
  });

  it("GET /api/docs/ abre a página do Swagger UI", async () => {
    const res = await request(app).get("/api/docs/");

    expect(res.status).toBe(200);
    expect(res.text).toContain("swagger-ui");
  });
});
