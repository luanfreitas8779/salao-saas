import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { sign } from "jsonwebtoken";

import {
  isAuthenticated,
  isAuthenticatedAllowingPasswordChange,
} from "./isAuthenticatedMiddleware";
import prismaClient from "../prisma/index";
import { ForbiddenError, UnauthorizedError } from "../errors/app-error";
import { env } from "../schemas/validateEnvSchema";

// O middleware confere o token E o banco: cada usuário tem um único token ativo.
// O token carrega a versão (ver); se ela não for a atual do usuário (houve um
// login novo ou a senha mudou), o token foi revogado.
// O Prisma é trocado por um falso, com a mesma técnica do isProf.test.ts.

vi.mock("../prisma/index", () => ({
  default: {
    users: { findUnique: vi.fn() },
  },
}));

const findUnique = vi.mocked(prismaClient.users.findUnique);

// valor definido no vitest.config.mts
const JWT_SECRET_TESTE = env.JWT_SECRET;

const res = {} as Response;
const next = vi.fn() as unknown as NextFunction;

function criarReq(authorization?: string) {
  return { headers: { authorization } } as Request;
}

function criarToken({ ver = 3, segredo = JWT_SECRET_TESTE } = {}) {
  return sign({ role: "CLIENT", ver }, segredo, { subject: "user-id-1", expiresIn: "1h" });
}

function usuarioNoBanco(sobrescrever: Record<string, unknown> = {}) {
  return {
    id: "user-id-1",
    role: "PROF",
    token_version: 3,
    must_change_password: false,
    ...sobrescrever,
  } as never;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("isAuthenticated", () => {
  it("chama o next quando o token é válido e é o token atual do usuário", async () => {
    findUnique.mockResolvedValue(usuarioNoBanco());
    const req = criarReq(`Bearer ${criarToken()}`);

    await isAuthenticated(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user_id).toBe("user-id-1");
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user-id-1" } }),
    );
  });

  it("usa o papel que está no banco, não o que veio no token", async () => {
    // o token diz CLIENT, mas o banco diz PROF: vale o banco
    findUnique.mockResolvedValue(usuarioNoBanco({ role: "PROF" }));
    const req = criarReq(`Bearer ${criarToken()}`);

    await isAuthenticated(req, res, next);

    expect(req.user_role).toBe("PROF");
  });

  it("recusa um token antigo: houve um login novo ou a senha mudou (versão diferente)", async () => {
    findUnique.mockResolvedValue(usuarioNoBanco({ token_version: 4 }));
    const req = criarReq(`Bearer ${criarToken({ ver: 3 })}`);

    await expect(isAuthenticated(req, res, next)).rejects.toThrow(
      new UnauthorizedError("Sessão encerrada, faça login novamente"),
    );
    expect(next).not.toHaveBeenCalled();
    expect(req.user_id).toBeUndefined();
  });

  it("recusa um token sem versão (emitido antes do token único existir)", async () => {
    findUnique.mockResolvedValue(usuarioNoBanco({ token_version: 0 }));
    const semVersao = sign({ role: "CLIENT" }, JWT_SECRET_TESTE, { subject: "user-id-1" });

    await expect(
      isAuthenticated(criarReq(`Bearer ${semVersao}`), res, next),
    ).rejects.toBeInstanceOf(UnauthorizedError);
    expect(next).not.toHaveBeenCalled();
  });

  it("recusa o token de um usuário que não existe mais", async () => {
    findUnique.mockResolvedValue(null as never);

    await expect(
      isAuthenticated(criarReq(`Bearer ${criarToken()}`), res, next),
    ).rejects.toThrow("Sessão encerrada, faça login novamente");
    expect(next).not.toHaveBeenCalled();
  });

  it("lança UnauthorizedError sem consultar o banco quando o header não é enviado", async () => {
    await expect(isAuthenticated(criarReq(), res, next)).rejects.toThrow(
      new UnauthorizedError("Token não informado"),
    );
    expect(findUnique).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it.each([
    ["um texto qualquer no lugar do token", "Bearer token-falso"],
    ["um token assinado com outro segredo", `Bearer ${criarToken({ segredo: "outro-segredo" })}`],
    ["o header só com a palavra Bearer", "Bearer"],
  ])("lança UnauthorizedError sem consultar o banco com %s", async (_caso, header) => {
    const req = criarReq(header);

    await expect(isAuthenticated(req, res, next)).rejects.toThrow(
      "Autenticação falhou, faça login novamente",
    );
    expect(findUnique).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    expect(req.user_id).toBeUndefined();
  });

  it("recusa um token que já nasceu vencido", async () => {
    // exp no passado (em segundos, como o JWT usa)
    const vencido = sign(
      { role: "CLIENT", ver: 3, exp: Math.floor(Date.now() / 1000) - 60 },
      JWT_SECRET_TESTE,
      { subject: "user-id-1" },
    );

    await expect(
      isAuthenticated(criarReq(`Bearer ${vencido}`), res, next),
    ).rejects.toBeInstanceOf(UnauthorizedError);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("Troca de senha obrigatória (primeiro acesso)", () => {
  it("isAuthenticated responde 403 enquanto a senha não for trocada", async () => {
    findUnique.mockResolvedValue(usuarioNoBanco({ must_change_password: true }));

    await expect(
      isAuthenticated(criarReq(`Bearer ${criarToken()}`), res, next),
    ).rejects.toThrow(new ForbiddenError("Troque a senha antes de continuar"));
    expect(next).not.toHaveBeenCalled();
  });

  it("isAuthenticatedAllowingPasswordChange deixa passar, para a pessoa conseguir trocar a senha", async () => {
    findUnique.mockResolvedValue(usuarioNoBanco({ must_change_password: true }));
    const req = criarReq(`Bearer ${criarToken()}`);

    await isAuthenticatedAllowingPasswordChange(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user_id).toBe("user-id-1");
  });

  it("isAuthenticatedAllowingPasswordChange continua recusando um token revogado", async () => {
    findUnique.mockResolvedValue(usuarioNoBanco({ token_version: 9 }));

    await expect(
      isAuthenticatedAllowingPasswordChange(criarReq(`Bearer ${criarToken({ ver: 3 })}`), res, next),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
