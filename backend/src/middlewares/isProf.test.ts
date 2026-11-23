import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";

import { isProf } from "./isProf";
import { ForbiddenError, UnauthorizedError } from "../errors/app-error";

// O isProf vem sempre depois do isAuthenticated, que já buscou o usuário no
// banco e preencheu req.user_id e req.user_role com o papel atual.
// Por isso aqui basta montar o req como o isAuthenticated deixaria.

const res = {} as Response;
const next = vi.fn() as unknown as NextFunction;

function criarReq(user_id?: string, user_role?: string) {
  return { user_id, user_role } as Request;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("isProf", () => {
  it("chama o next quando o usuário é PROF", async () => {
    await isProf(criarReq("user-id-1", "PROF"), res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("lança ForbiddenError e não chama o next quando o usuário é CLIENT", async () => {
    await expect(isProf(criarReq("user-id-1", "CLIENT"), res, next)).rejects.toThrow(
      new ForbiddenError("Usuário sem permissão"),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("lança UnauthorizedError quando não passou pelo isAuthenticated (sem user_id)", async () => {
    await expect(isProf(criarReq(), res, next)).rejects.toThrow(
      new UnauthorizedError("Usuário não autenticado"),
    );
    expect(next).not.toHaveBeenCalled();
  });
});
