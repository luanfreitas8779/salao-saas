import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

import { ProcedureController } from "./procedure.controller";
import type { ProcedureService } from "./procedure.service";
import { NotFoundError } from "../../errors/app-error";

// O controller tira os dados do req, chama o service e monta a resposta.
// A regra de negócio já é testada no procedure.service.test.ts.

const service = {
  createProcedure: vi.fn(),
  deleteProcedure: vi.fn(),
  editProcedure: vi.fn(),
  findAllProcedures: vi.fn(),
  findActiveProcedures: vi.fn(),
};

const controller = new ProcedureController(service as unknown as ProcedureService);

// res.status() devolve o próprio res, para o encadeamento res.status(200).json(...)
function criarRes() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

function criarReq(dados: Partial<Request>) {
  return { body: {}, params: {}, ...dados } as Request;
}

const dados = {
  name: "Corte feminino",
  description: "Corte com lavagem",
  price: 8000,
  duration_minutes: 60,
};

const procedimento = { id: "procedure-id-1", ...dados, is_active: true };

beforeEach(() => {
  vi.resetAllMocks();
});

describe("ProcedureController.createNewProcedure", () => {
  it("passa os 4 campos ao service e responde 201 com { createNewProcedure }", async () => {
    service.createProcedure.mockResolvedValue(procedimento);
    const res = criarRes();

    await controller.createNewProcedure(
      criarReq({ body: { ...dados, is_active: false } }), // is_active não pode vir do body
      res as unknown as Response,
    );

    expect(service.createProcedure).toHaveBeenCalledWith(dados);
    expect(service.createProcedure).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ createNewProcedure: procedimento });
  });

  it("repassa o erro do service e não responde nada (quem responde é o handler global)", async () => {
    const erro = new NotFoundError("qualquer erro");
    service.createProcedure.mockRejectedValue(erro);
    const res = criarRes();

    await expect(
      controller.createNewProcedure(criarReq({ body: dados }), res as unknown as Response),
    ).rejects.toBe(erro);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("ProcedureController.deleteProcedure", () => {
  it("pega o id da URL e responde 200 com { deleteProcedure }", async () => {
    const desativado = { ...procedimento, is_active: false };
    service.deleteProcedure.mockResolvedValue(desativado);
    const res = criarRes();

    await controller.deleteProcedure(
      criarReq({ params: { id: "procedure-id-1" } }),
      res as unknown as Response,
    );

    expect(service.deleteProcedure).toHaveBeenCalledWith({ id: "procedure-id-1" });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ deleteProcedure: desativado });
  });
});

describe("ProcedureController.editProcedure", () => {
  it("usa o id da URL (não um id do body) junto com os campos do body", async () => {
    service.editProcedure.mockResolvedValue(procedimento);
    const res = criarRes();

    await controller.editProcedure(
      criarReq({
        params: { id: "procedure-id-1" },
        body: { ...dados, id: "outro-procedimento" },
      }),
      res as unknown as Response,
    );

    expect(service.editProcedure).toHaveBeenCalledWith({ id: "procedure-id-1", ...dados });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ editProcedure: procedimento });
  });
});

describe("ProcedureController.findAllProcedures / findActiveProcedures", () => {
  it("responde 200 com { findAllProcedures }", async () => {
    const lista = [procedimento];
    service.findAllProcedures.mockResolvedValue(lista);
    const res = criarRes();

    await controller.findAllProcedures(criarReq({}), res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ findAllProcedures: lista });
  });

  it("responde 200 com { findActiveProcedures }", async () => {
    const lista = [procedimento];
    service.findActiveProcedures.mockResolvedValue(lista);
    const res = criarRes();

    await controller.findActiveProcedures(criarReq({}), res as unknown as Response);

    expect(service.findAllProcedures).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ findActiveProcedures: lista });
  });
});
