import { it, describe, expect, vi } from "vitest";

import {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  AppError,
  ValidationError
} from "./app-error";

describe("Teste das funções de tratamento de erro", () => {
  const details = [{
    campo: "Login",
    message: "Login deve ter no mínimo 4 caracteres"
  }]
  const appError = new AppError("TESTE APP ERROR", 500)
  const badRequest = new BadRequestError("TESTE BAD REQUEST");
  const unauthorized = new UnauthorizedError("TESTE UNAUTHORIZED");
  const forbidden = new ForbiddenError("TESTE FORBIDDEN");
  const notFound = new NotFoundError("TESTE NOT FOUND");
  const conflict = new ConflictError("TESTE CONFLICT");
  const validation = new ValidationError(details)
  describe("Teste dos status code corretos dos erros", () => {
    it("BadRequestError tem status 400", () => {
      expect(badRequest.statusCode).toBe(400);
    });
    it("UnauthorizedError tem status 401", () => {
      expect(unauthorized.statusCode).toBe(401);
    });
    it("ForbiddenError tem status 403", () => {
      expect(forbidden.statusCode).toBe(403);
    });
    it("NotFoundError tem status 404", () => {
      expect(notFound.statusCode).toBe(404);
    });
    it("ConflictError tem status 409", () => {
      expect(conflict.statusCode).toBe(409);
    });
  });
  describe("Teste das mensagens dos erros", () => {
    it("BadRequestError tem mensagem 'TESTE BAD REQUEST'", () => {
        expect(badRequest.message).toBe("TESTE BAD REQUEST")
    })
    it("UnauthorizedError tem mensagem 'TESTE UNAUTHORIZED'", () => {
        expect(unauthorized.message).toBe("TESTE UNAUTHORIZED")
    })
    it("ForbiddenError tem mensagem 'TESTE FORBIDDEN'", () => {
        expect(forbidden.message).toBe("TESTE FORBIDDEN")
    })
    it("NotFoundError tem mensagem 'TESTE NOT FOUND'", () => {
        expect(notFound.message).toBe("TESTE NOT FOUND")
    })
    it("ConflictError tem mensagem 'TESTE CONFLICT'", () => {
        expect(conflict.message).toBe("TESTE CONFLICT")
    })
  })
  describe("Verifica a herança se são do tipo Error", () => {
    it("AppError deve ter herança do Error", () => {
        expect(appError).toBeInstanceOf(Error)
    })
    it("BadRequestError deve ter herança AppError e Error", () =>{
        expect(badRequest).toBeInstanceOf(AppError)
        expect(badRequest).toBeInstanceOf(Error)
        expect(badRequest).not.toBeInstanceOf(NotFoundError)
    })
    it("UnauthorizedError deve ter herança AppError e Error", () => {
        expect(unauthorized).toBeInstanceOf(AppError)
        expect(unauthorized).toBeInstanceOf(Error)
    })
    it("ForbiddenError deve ter herança AppError e Error", () => {
        expect(forbidden).toBeInstanceOf(AppError)
        expect(forbidden).toBeInstanceOf(Error)
    })
    it("NotFoundError deve ter herança AppError e Error", () => {
        expect(notFound).toBeInstanceOf(AppError)
        expect(notFound).toBeInstanceOf(Error)
    })
    it("ConflictError deve ter herança AppError e Error", () => {
        expect(conflict).toBeInstanceOf(AppError)
        expect(conflict).toBeInstanceOf(Error)
    })

  })
  describe("Testes do ValidationError", () => {
    it("ValidationError deve ter a mensagem 'Erro de validação'", () => {
        expect(validation.message).toBe("Erro de validação")
    })
    it("ValidationError deve ter details array de objeto [{campo: 'Login', message: 'Login deve ter no mínimo 4 caracteres'}]", () => {
         expect(validation.details).toEqual([{campo: "Login", message: "Login deve ter no mínimo 4 caracteres"}])
    })
    it("ValidationError deve ter statusCode = 400", () => {
         expect(validation.statusCode).toBe(400)
    })
  })

});
