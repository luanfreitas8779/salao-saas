import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";

import { errorHandler } from "./errorHandler";
import {
  ConflictError,
  InternalServerError,
  NotFoundError,
  ValidationError,
} from "../errors/app-error";

// O handler global decide o que o cliente da API recebe quando algo dá errado.

const req = {} as Request;
const next = vi.fn() as unknown as NextFunction;

// res.status() devolve o próprio res, para o encadeamento res.status(404).json(...)
function criarRes() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("errorHandler", () => {
  it.each([
    { erro: new NotFoundError("Procedimento não encontrado"), status: 404 },
    { erro: new ConflictError("O procedimento Corte já existe!"), status: 409 },
    { erro: new InternalServerError("Erro ao enviar email"), status: 500 },
  ])("$erro.constructor.name vira status $status com a mensagem do erro", ({ erro, status }) => {
    const res = criarRes();

    errorHandler(erro, req, res as unknown as Response, next);

    expect(res.status).toHaveBeenCalledWith(status);
    expect(res.json).toHaveBeenCalledWith({ message: erro.message });
  });

  it("ValidationError devolve também os details, para o front saber qual campo está errado", () => {
    const details = [{ campo: "email", message: "Digite um email válido!" }];
    const res = criarRes();

    errorHandler(new ValidationError(details), req, res as unknown as Response, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Erro de validação", details });
  });

  it("um erro que não é AppError vira 500 genérico, sem vazar a mensagem interna", () => {
    const res = criarRes();

    errorHandler(
      new Error("connection refused at 10.0.0.5:5432"),
      req,
      res as unknown as Response,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal Server Error" });
  });

  it("não devolve o campo details quando o erro não é de validação", () => {
    const res = criarRes();

    errorHandler(new NotFoundError("x"), req, res as unknown as Response, next);

    expect(res.json.mock.calls[0]![0]).not.toHaveProperty("details");
  });
});
