import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";

import { isAdmin } from "./isAdmin";
import prismaClient from "../prisma/index";
import { ForbiddenError, UnauthorizedError } from "../errors/app-error";

// O isAdmin chama o Prisma direto (sem repository). Para não depender do banco,
// o módulo do Prisma é trocado por um falso, com a mesma técnica do vi.mock
// que o user.service.test.ts usa para o e-mail.

vi.mock("../prisma/index", () => ({
  default: {
    users: { findFirst: vi.fn() },
  },
}));

const findFirst = vi.mocked(prismaClient.users.findFirst);

const res = {} as Response;
const next = vi.fn() as unknown as NextFunction;

function criarReq(user_id?: string) {
  return { user_id } as Request;
}

function criarUsuario(role: "ADMIN" | "CLIENT") {
  return {
    id: "user-id-1",
    name: "Maria",
    email: "maria@email.com",
    phone: "11999999999",
    password_hash: "hash",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("isAdmin", () => {
  it("chama o next e confirma o papel no req quando o usuário é ADMIN", async () => {
    findFirst.mockResolvedValue(criarUsuario("ADMIN") as never);
    const req = criarReq("user-id-1");

    await isAdmin(req, res, next);

    expect(findFirst).toHaveBeenCalledWith({ where: { id: "user-id-1" } });
    expect(req.user_role).toBe("ADMIN");
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("lança ForbiddenError e não chama o next quando o usuário é CLIENT", async () => {
    findFirst.mockResolvedValue(criarUsuario("CLIENT") as never);

    await expect(isAdmin(criarReq("user-id-1"), res, next)).rejects.toThrow(
      new ForbiddenError("Usuário sem permissão"),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("lança UnauthorizedError sem consultar o banco quando não há user_id", async () => {
    await expect(isAdmin(criarReq(), res, next)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect(findFirst).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("lança UnauthorizedError quando o usuário do token não existe mais", async () => {
    findFirst.mockResolvedValue(null as never);

    await expect(isAdmin(criarReq("apagado"), res, next)).rejects.toThrow(
      new UnauthorizedError("Usuário não autenticado"),
    );
    expect(next).not.toHaveBeenCalled();
  });
});
