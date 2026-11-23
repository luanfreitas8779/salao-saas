import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";

import { validateSchema } from "./validateSchema";
import { authLoginSchema } from "../schemas/users/authLoginSchema";
import { createUserSchema } from "../schemas/users/userSchema";
import { appointmentAvailabilitySchema } from "../schemas/appointments/appointmentAvailabilitySchema";
import { InternalServerError, ValidationError } from "../errors/app-error";

// O middleware não devolve os dados validados pelo `return` (ele devolve o
// que o next() devolver). Ele REESCREVE o próprio req. Por isso os testes
// olham o req depois de chamar o middleware.

const res = {} as Response;
const next = vi.fn() as unknown as NextFunction;

function criarReq(dados: Partial<Request>) {
  return { body: {}, query: {}, params: {}, ...dados } as Request;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("validateSchema", () => {
  it("chama o next uma vez e sem erro quando a entrada é válida", async () => {
    const req = criarReq({
      body: { email: "maria@email.com", password: "senha123" },
    });

    await validateSchema(authLoginSchema)(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("reescreve o req.body com o valor transformado pelo schema (telefone limpo)", async () => {
    // o authLoginSchema não transforma nada: com ele, este teste passaria
    // mesmo se o middleware não reescrevesse o body. O createUserSchema limpa
    // o telefone, então o que sai é diferente do que entrou.
    const req = criarReq({
      body: {
        name: "Maria da Silva",
        email: "maria@email.com",
        phone: "(11) 99999-9999",
        password: "senha123",
      },
    });

    await validateSchema(createUserSchema)(req, res, next);

    expect(req.body.phone).toBe("11999999999");
  });

  it("remove do req.body os campos que o schema não conhece", async () => {
    const req = criarReq({
      body: { email: "maria@email.com", password: "senha123", role: "PROF" },
    });

    await validateSchema(authLoginSchema)(req, res, next);

    expect(req.body).toEqual({ email: "maria@email.com", password: "senha123" });
  });

  it("reescreve também o req.query quando o schema valida a query", async () => {
    const req = criarReq({
      query: {
        procedure_id: "3f1c9a52-8c4e-4f7a-9d2b-6a1e5c7b8d90",
        date: "2099-01-05",
        extra: "ignorar",
      },
    });

    await validateSchema(appointmentAvailabilitySchema)(req, res, next);

    expect(req.query).toEqual({
      procedure_id: "3f1c9a52-8c4e-4f7a-9d2b-6a1e5c7b8d90",
      date: "2099-01-05",
    });
  });

  it("funciona com o req.query só de leitura do Express 5", async () => {
    // No Express 5 o req.query é um getter: `req.query = ...` lança TypeError.
    // Um objeto comum (como o criarReq) esconde esse problema; este imita o Express.
    const req = criarReq({});
    Object.defineProperty(req, "query", {
      get: () => ({ procedure_id: "3f1c9a52-8c4e-4f7a-9d2b-6a1e5c7b8d90", date: "2099-01-05" }),
      configurable: true,
    });

    await validateSchema(appointmentAvailabilitySchema)(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.query).toEqual({
      procedure_id: "3f1c9a52-8c4e-4f7a-9d2b-6a1e5c7b8d90",
      date: "2099-01-05",
    });
  });

  it("lança ValidationError e não chama o next quando a entrada é inválida", async () => {
    const req = criarReq({ body: { email: "sem-arroba", password: "senha123" } });

    await expect(
      validateSchema(authLoginSchema)(req, res, next),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(next).not.toHaveBeenCalled();
  });

  it("monta o details sem o prefixo 'body' no nome do campo", async () => {
    // o path do Zod vem como ["body", "email"]; o slice(1) tira o "body"
    const req = criarReq({ body: { email: "sem-arroba", password: "123" } });

    await expect(validateSchema(authLoginSchema)(req, res, next)).rejects.toMatchObject({
      details: [
        { campo: "email", message: "Digite um email válido!" },
        { campo: "password", message: expect.any(String) },
      ],
    });
  });

  it("lança InternalServerError quando o erro não vem do Zod", async () => {
    const schemaQuebrado = {
      parseAsync: vi.fn().mockRejectedValue(new Error("falha inesperada")),
    } as unknown as ZodType;

    await expect(
      validateSchema(schemaQuebrado)(criarReq({}), res, next),
    ).rejects.toBeInstanceOf(InternalServerError);
    expect(next).not.toHaveBeenCalled();
  });
});
