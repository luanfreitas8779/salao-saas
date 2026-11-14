import { it, describe, expect, vi } from "vitest";

import {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  AppError,
  ValidationError,
  TooManyRequestsError,
  InternalServerError
} from "./app-error";


describe("Testa o status code correto das classes de erro", () => {
  it.each([
    {erro: BadRequestError, status: 400},
    {erro: UnauthorizedError, status: 401},
    {erro: ForbiddenError, status: 403},
    {erro: NotFoundError, status: 404},
    {erro: ConflictError, status: 409},
    {erro: TooManyRequestsError, status: 429},
    {erro: InternalServerError, status: 500},
  ])("$erro.name tem status igual a $status", ({ erro, status}) => {
    expect(new erro("x").statusCode).toBe(status)
  })
  it("Verifica se o status do AppError é igual ao recebido", () => {
    expect(new AppError("x", 400).statusCode).toBe(400)
  })
})

describe("Testa se a mensagem de erro retornada é a mesma recebida", () => {
  it.each([
    {erro: BadRequestError, message: "Bad Request Error"},
    {erro: UnauthorizedError, message: "Unauthorized Error"},
    {erro: ForbiddenError, message: "Forbidden Error"},
    {erro: NotFoundError, message: "Not Found Error"},
    {erro: ConflictError, message: "Conflict Error"},
    {erro: TooManyRequestsError, message: "Too Many Requests Error"},
    {erro: InternalServerError, message: "Internal Server Error"}
  ])("$erro.name deve retornar a mensagem $message", ({erro, message}) => {
    expect(new erro(message).message).toBe(message)
  })
  it("Verifica se a mensagem retornada pelo AppError é a mesma recebida", () => {
    expect(new AppError("x", 400).message).toBe("x")
  })
})

describe("Verifica se as classes de erro herdam corretamente o Error", () => {
  it.each([
    {erro: BadRequestError, type: Error },
    {erro: UnauthorizedError, type: Error},
    {erro: ForbiddenError, type: Error},
    {erro: NotFoundError, type: Error},
    {erro: ConflictError, type: Error},
    {erro: TooManyRequestsError, type: Error},
    {erro: InternalServerError, type: Error},
  ])("$erro.name deve ter herança $type", ({erro, type}) => {
    expect(new erro("x")).toBeInstanceOf(type)
  })

  it("Verifica se AppError herda corretamente o Error", () =>{
    expect(new AppError("x", 400)).toBeInstanceOf(Error)
  })
})

describe("Verifica se as classes de erro herdam corretamente o AppError", () => {
  it.each([
    {erro: BadRequestError, type: AppError },
    {erro: UnauthorizedError, type: AppError},
    {erro: ForbiddenError, type: AppError},
    {erro: NotFoundError, type: AppError},
    {erro: ConflictError, type: AppError},
    {erro: TooManyRequestsError, type: AppError},
    {erro: InternalServerError, type: AppError}
  ])("$erro.name deve ter herança $type", ({erro, type}) => {
    expect(new erro("x")).toBeInstanceOf(type)
  })
  it("Verifica se o AppError não herda BadRequestError", () => {
    expect(new AppError("x", 400)).not.toBeInstanceOf(BadRequestError)
  })
})

describe("Verifica se as classes de erro não herdam algum erro semelhante", () => {
  it.each([
    {erro: BadRequestError, type: UnauthorizedError },
    {erro: UnauthorizedError, type: ForbiddenError},
    {erro: ForbiddenError, type: NotFoundError},
    {erro: NotFoundError, type: ConflictError},
    {erro: ConflictError, type: BadRequestError},
    {erro: TooManyRequestsError, type: InternalServerError},
    {erro: InternalServerError, type: TooManyRequestsError}
  ])("$erro.name não deve ter herança $type", ({erro, type}) => {
    expect(new erro("x")).not.toBeInstanceOf(type)
  })
})

  describe("Testes do ValidationError", () => {
    const details = [{campo: "Login", message: "Login deve ter no minimo 4 caracteres"}]
    const validation = new ValidationError(details)
    it("ValidationError deve ter a mensagem 'Erro de validação'", () => {
        expect( validation.message).toBe("Erro de validação")
    })
    it("ValidationError deve ter details array de objeto [{campo: 'Login', message: 'Login deve ter no mínimo 4 caracteres'}]", () => {
         expect(validation.details).toEqual([{campo: "Login", message: "Login deve ter no minimo 4 caracteres"}])
    })
    it("ValidationError deve ter statusCode = 400", () => {
         expect(validation.statusCode).toBe(400)
    })
    it("ValidationError é instância de ValidationError", () => {
         expect(validation).toBeInstanceOf(ValidationError)
    })
    it("ValidationError herda corretamente o AppError", () => {
         expect(validation).toBeInstanceOf(AppError)
    })
    it("ValidationError herda corretamente o Error", () => {
         expect(validation).toBeInstanceOf(Error)
    })
    it("ValidationError não herda o BadRequestError, que tem o mesmo status", () => {
         expect(validation).not.toBeInstanceOf(BadRequestError)
    })
  })
