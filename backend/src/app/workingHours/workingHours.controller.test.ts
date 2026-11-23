import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

import { WorkingHoursController } from "./workingHours.controller";
import type { WorkingHoursService } from "./workingHours.service";

// O controller tira o newData do body, chama o service e responde.

const service = {
  updateWorkingHours: vi.fn(),
  listWorkingHours: vi.fn(),
};

const controller = new WorkingHoursController(
  service as unknown as WorkingHoursService,
);

// res.status() devolve o próprio res, para o caso de o controller usar o encadeamento
function criarRes() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("WorkingHoursController.listWorkingHours", () => {
  it("responde 200 com a lista de dias", async () => {
    const dias = [{ id: "wh-0", dayOfWeek: 0 }];
    service.listWorkingHours.mockResolvedValue(dias);
    const res = criarRes();

    await controller.listWorkingHours({} as Request, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(dias);
  });
});

describe("WorkingHoursController.updateWorkingHours", () => {
  it("passa a lista newData do body ao service e responde com o resultado", async () => {
    const newData = [
      { day: 1, start_time: "08:00", end_time: "18:00", isOpen: true },
      { day: 0, start_time: "08:00", end_time: "12:00", isOpen: false },
    ];
    const atualizados = [{ id: "wh-1" }, { id: "wh-0" }];
    service.updateWorkingHours.mockResolvedValue(atualizados);
    const res = criarRes();

    await controller.updateWorkingHours(
      { body: { newData } } as Request,
      res as unknown as Response,
    );

    expect(service.updateWorkingHours).toHaveBeenCalledWith(newData);
    expect(service.updateWorkingHours).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(atualizados);
  });

  it("repassa o erro do service e não responde nada", async () => {
    const erro = new Error("falha no banco");
    service.updateWorkingHours.mockRejectedValue(erro);
    const res = criarRes();

    await expect(
      controller.updateWorkingHours({ body: { newData: [] } } as Request, res as unknown as Response),
    ).rejects.toBe(erro);
    expect(res.json).not.toHaveBeenCalled();
  });
});
