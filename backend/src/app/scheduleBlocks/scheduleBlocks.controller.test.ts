import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

import { ScheduleBlocksController } from "./scheduleBlocks.controller";
import type { ScheduleBlocksService } from "./scheduleBlocks.service";
import { BadRequestError } from "../../errors/app-error";

// Este controller tem uma responsabilidade a mais: o body chega com as datas
// em texto (ISO) e o service espera objetos Date. A conversão é feita aqui.

const service = {
  createScheduleBlock: vi.fn(),
  listScheduleBlocks: vi.fn(),
  updateScheduleBlock: vi.fn(),
  deleteScheduleBlock: vi.fn(),
};

const controller = new ScheduleBlocksController(
  service as unknown as ScheduleBlocksService,
);

// res.status() devolve o próprio res, para o encadeamento res.status(201).json(...)
function criarRes() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

function criarReq(dados: Partial<Request>) {
  return { body: {}, params: {}, query: {}, ...dados } as Request;
}

const body = {
  start_time: "2099-01-05T11:00:00.000Z",
  end_time: "2099-01-05T21:00:00.000Z",
  reason: "Feriado",
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("ScheduleBlocksController.createScheduleBlock", () => {
  it("converte as datas do body para Date antes de chamar o service", async () => {
    service.createScheduleBlock.mockResolvedValue({ id: "block-1" });

    await controller.createScheduleBlock(
      criarReq({ body }),
      criarRes() as unknown as Response,
    );

    const recebido = service.createScheduleBlock.mock.calls[0]![0];
    expect(recebido.start_time).toBeInstanceOf(Date);
    expect(recebido.end_time).toBeInstanceOf(Date);
    expect(recebido).toEqual({
      start_time: new Date(body.start_time),
      end_time: new Date(body.end_time),
      reason: "Feriado",
    });
    expect(service.createScheduleBlock).toHaveBeenCalledTimes(1);
  });

  it("responde 201 com o bloqueio criado", async () => {
    const bloqueio = { id: "block-1", reason: "Feriado" };
    service.createScheduleBlock.mockResolvedValue(bloqueio);
    const res = criarRes();

    await controller.createScheduleBlock(criarReq({ body }), res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(bloqueio);
  });

  it("repassa o erro do service e não responde nada (quem responde é o handler global)", async () => {
    const erro = new BadRequestError("qualquer erro");
    service.createScheduleBlock.mockRejectedValue(erro);
    const res = criarRes();

    await expect(
      controller.createScheduleBlock(criarReq({ body }), res as unknown as Response),
    ).rejects.toBe(erro);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("ScheduleBlocksController.listScheduleBlocks", () => {
  it("pega o período da query e responde 200 com a lista", async () => {
    const lista = [{ id: "block-1" }];
    service.listScheduleBlocks.mockResolvedValue(lista);
    const res = criarRes();

    await controller.listScheduleBlocks(
      criarReq({ query: { start_date: "2099-01-05", end_date: "2099-01-11" } }),
      res as unknown as Response,
    );

    expect(service.listScheduleBlocks).toHaveBeenCalledWith("2099-01-05", "2099-01-11");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(lista);
  });
});

describe("ScheduleBlocksController.updateScheduleBlock", () => {
  it("usa o id da URL, converte as datas para Date e responde 200", async () => {
    const atualizado = { id: "block-1", reason: "Feriado" };
    service.updateScheduleBlock.mockResolvedValue(atualizado);
    const res = criarRes();

    await controller.updateScheduleBlock(
      criarReq({ params: { id: "block-1" }, body }),
      res as unknown as Response,
    );

    expect(service.updateScheduleBlock).toHaveBeenCalledWith({
      id: "block-1",
      start_time: new Date(body.start_time),
      end_time: new Date(body.end_time),
      reason: "Feriado",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(atualizado);
  });
});

describe("ScheduleBlocksController.deleteScheduleBlock", () => {
  it("usa o id da URL e responde 200 com o bloqueio removido", async () => {
    const removido = { id: "block-1" };
    service.deleteScheduleBlock.mockResolvedValue(removido);
    const res = criarRes();

    await controller.deleteScheduleBlock(
      criarReq({ params: { id: "block-1" } }),
      res as unknown as Response,
    );

    expect(service.deleteScheduleBlock).toHaveBeenCalledWith({ id: "block-1" });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(removido);
  });
});
