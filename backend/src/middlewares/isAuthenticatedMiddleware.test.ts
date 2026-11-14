import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { sign } from "jsonwebtoken";

import { isAuthenticated } from "./isAuthenticatedMiddleware";
import { UnauthorizedError } from "../errors/app-error";

// O middleware é SÍNCRONO: lança o erro na hora, sem Promise.
// Por isso o padrão aqui é expect(() => ...).toThrow(), e não o .rejects.

const JWT_SECRET_TESTE = "segredo-so-para-testes";

const res = {} as Response;
const next = vi.fn() as unknown as NextFunction;

function criarReq(authorization?: string) {
  return { headers: { authorization } } as Request;
}

function criarToken(segredo = JWT_SECRET_TESTE) {
  return sign({ role: "ADMIN" }, segredo, { subject: "user-id-1", expiresIn: "1h" });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("JWT_SECRET", JWT_SECRET_TESTE);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isAuthenticated", () => {
  it("chama o next e preenche user_id e user_role com o que estava no token", () => {
    const req = criarReq(`Bearer ${criarToken()}`);

    isAuthenticated(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user_id).toBe("user-id-1");
    expect(req.user_role).toBe("ADMIN");
  });

  it("lança UnauthorizedError quando o header authorization não é enviado", () => {
    const req = criarReq();

    expect(() => isAuthenticated(req, res, next)).toThrow(
      new UnauthorizedError("Token não informado"),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it.each([
    ["um texto qualquer no lugar do token", "Bearer token-falso"],
    ["um token assinado com outro segredo", `Bearer ${criarToken("outro-segredo")}`],
    ["o header só com a palavra Bearer", "Bearer"],
  ])("lança UnauthorizedError com %s", (_caso, header) => {
    const req = criarReq(header);

    expect(() => isAuthenticated(req, res, next)).toThrow(
      "Autenticação falhou, faça login novamente",
    );
    expect(next).not.toHaveBeenCalled();
    expect(req.user_id).toBeUndefined();
  });

  it("recusa um token que já nasceu vencido", () => {
    // exp no passado (em segundos, como o JWT usa)
    const vencido = sign(
      { role: "CLIENT", exp: Math.floor(Date.now() / 1000) - 60 },
      JWT_SECRET_TESTE,
      { subject: "user-id-1" },
    );

    expect(() => isAuthenticated(criarReq(`Bearer ${vencido}`), res, next)).toThrow(
      UnauthorizedError,
    );
    expect(next).not.toHaveBeenCalled();
  });
});
