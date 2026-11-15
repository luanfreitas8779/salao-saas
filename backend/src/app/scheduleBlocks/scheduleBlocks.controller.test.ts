import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

import { ScheduleBlocksController } from "./scheduleBlocks.controller";
import type { ScheduleBlocksService } from "./scheduleBlocks.service";
import { BadRequestError } from "../../errors/app-error";

// Este controller tem uma responsabilidade a mais: o body chega com as datas
// em texto (ISO) e o service espera objetos Date. A conversão é feita aqui.

const service = {
  createScheduleBlock: vi.fn(),
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
  return { body: {}, params: {}, ...dados } as Request;
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

  it("responde 201 com { result }", async () => {
    const bloqueio = { id: "block-1", reason: "Feriado" };
    service.createScheduleBlock.mockResolvedValue(bloqueio);
    const res = criarRes();

    await controller.createScheduleBlock(criarReq({ body }), res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ result: bloqueio });
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
