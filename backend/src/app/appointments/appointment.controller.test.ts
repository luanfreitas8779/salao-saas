import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

import { AppointmentController } from "./appointment.controller";
import type { AppointmentService } from "./appointment.service";
import { ForbiddenError } from "../../errors/app-error";

// O controller tira os dados do req, chama o service e monta a resposta.
// Ponto de atenção: quem está agindo (actor_id / actor_role) vem SEMPRE do
// token (req.user_id / req.user_role), preenchido pelo isAuthenticated.
// A regra de negócio já é testada no appointment.service.test.ts.

const service = {
  availableTimes: vi.fn(),
  createAppointment: vi.fn(),
  listMine: vi.fn(),
  listBoard: vi.fn(),
  cancelAppointment: vi.fn(),
  updateAppointment: vi.fn(),
  completeAppointment: vi.fn(),
};

const controller = new AppointmentController(service as unknown as AppointmentService);

// res.status() devolve o próprio res, para o encadeamento res.status(200).json(...)
function criarRes() {
  const res = { status: vi.fn(), json: vi.fn(), set: vi.fn() };
  res.status.mockReturnValue(res);
  res.set.mockReturnValue(res);
  return res;
}

function criarReq(dados: Partial<Request>) {
  return { body: {}, params: {}, query: {}, ...dados } as Request;
}

const PROCEDIMENTO_ID = "procedure-id-1";
const agendamento = { id: "appointment-id-1", status: "SCHEDULED" };

beforeEach(() => {
  vi.resetAllMocks();
});

describe("AppointmentController.availableTimes", () => {
  it("pega procedimento e data da query e responde 200 com a lista pura", async () => {
    service.availableTimes.mockResolvedValue(["08:00", "10:00"]);
    const res = criarRes();

    await controller.availableTimes(
      criarReq({ query: { procedure_id: PROCEDIMENTO_ID, date: "2099-01-05" } }),
      res as unknown as Response,
    );

    expect(service.availableTimes).toHaveBeenCalledWith({
      procedure_id: PROCEDIMENTO_ID,
      date: "2099-01-05",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(["08:00", "10:00"]);
  });
});

describe("AppointmentController.createAppointment", () => {
  it("usa quem está logado como actor e responde 201 com o agendamento", async () => {
    service.createAppointment.mockResolvedValue(agendamento);
    const res = criarRes();

    await controller.createAppointment(
      criarReq({
        user_id: "client-id-1",
        user_role: "CLIENT",
        body: {
          start_time: "2099-01-05T12:00:00.000Z",
          observation: "Cabelo longo",
          procedure_id: PROCEDIMENTO_ID,
          client_id: "client-id-1",
        },
      }),
      res as unknown as Response,
    );

    expect(service.createAppointment).toHaveBeenCalledWith({
      start_time: "2099-01-05T12:00:00.000Z",
      observation: "Cabelo longo",
      actor_id: "client-id-1",
      actor_role: "CLIENT",
      procedure_id: PROCEDIMENTO_ID,
      client_id: "client-id-1",
    });
    expect(service.createAppointment).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(agendamento);
  });

  it("ignora actor_id e actor_role enviados no body (ninguém se passa por admin)", async () => {
    service.createAppointment.mockResolvedValue(agendamento);

    await controller.createAppointment(
      criarReq({
        user_id: "client-id-1",
        user_role: "CLIENT",
        body: {
          start_time: "2099-01-05T12:00:00.000Z",
          procedure_id: PROCEDIMENTO_ID,
          actor_id: "prof-id-1",
          actor_role: "PROF",
        },
      }),
      criarRes() as unknown as Response,
    );

    expect(service.createAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ actor_id: "client-id-1", actor_role: "CLIENT" }),
    );
  });

  it("repassa o erro do service e não responde nada (quem responde é o handler global)", async () => {
    const erro = new ForbiddenError("qualquer erro");
    service.createAppointment.mockRejectedValue(erro);
    const res = criarRes();

    await expect(
      controller.createAppointment(
        criarReq({ user_id: "client-id-1", body: {} }),
        res as unknown as Response,
      ),
    ).rejects.toBe(erro);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("AppointmentController.listMine", () => {
  it("lista a página pedida de quem está logado: a lista no corpo e o total no header", async () => {
    service.listMine.mockResolvedValue({ items: [agendamento], total: 41 });
    const res = criarRes();

    await controller.listMine(
      criarReq({ user_id: "client-id-1", query: { page: 3, limit: 20 } as never }),
      res as unknown as Response,
    );

    expect(service.listMine).toHaveBeenCalledWith("client-id-1", { page: 3, limit: 20 });
    expect(res.set).toHaveBeenCalledWith("X-Total-Count", "41");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([agendamento]);
  });
});

describe("AppointmentController.listBoard", () => {
  it("pega o período da query e responde 200", async () => {
    service.listBoard.mockResolvedValue([agendamento]);
    const res = criarRes();

    await controller.listBoard(
      criarReq({ query: { start_date: "2099-01-05", end_date: "2099-01-11" } }),
      res as unknown as Response,
    );

    expect(service.listBoard).toHaveBeenCalledWith("2099-01-05", "2099-01-11");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([agendamento]);
  });
});

describe("AppointmentController.cancelAppointment", () => {
  it("cancela o agendamento da URL em nome de quem está logado e responde 200", async () => {
    const cancelado = { ...agendamento, status: "CANCELLED" };
    service.cancelAppointment.mockResolvedValue(cancelado);
    const res = criarRes();

    await controller.cancelAppointment(
      criarReq({
        params: { id: "appointment-id-1" },
        user_id: "client-id-1",
        user_role: "CLIENT",
      }),
      res as unknown as Response,
    );

    expect(service.cancelAppointment).toHaveBeenCalledWith({
      appointmentId: "appointment-id-1",
      actor_id: "client-id-1",
      actor_role: "CLIENT",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(cancelado);
  });
});

describe("AppointmentController.updateAppointment", () => {
  it("junta o id da URL, quem está logado e os campos do body, e responde 200", async () => {
    service.updateAppointment.mockResolvedValue(agendamento);
    const res = criarRes();

    await controller.updateAppointment(
      criarReq({
        params: { id: "appointment-id-1" },
        user_id: "client-id-1",
        user_role: "CLIENT",
        body: {
          start_time: "2099-01-06T12:00:00.000Z",
          procedure_id: PROCEDIMENTO_ID,
          observation: "Trocar o horário",
        },
      }),
      res as unknown as Response,
    );

    expect(service.updateAppointment).toHaveBeenCalledWith({
      appointmentId: "appointment-id-1",
      actor_id: "client-id-1",
      actor_role: "CLIENT",
      start_time: "2099-01-06T12:00:00.000Z",
      procedure_id: PROCEDIMENTO_ID,
      observation: "Trocar o horário",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(agendamento);
  });
});

describe("AppointmentController.completeAppointment", () => {
  it("conclui o agendamento da URL e responde 200", async () => {
    const concluido = { ...agendamento, status: "COMPLETED" };
    service.completeAppointment.mockResolvedValue(concluido);
    const res = criarRes();

    await controller.completeAppointment(
      criarReq({ params: { id: "appointment-id-1" } }),
      res as unknown as Response,
    );

    expect(service.completeAppointment).toHaveBeenCalledWith({
      appointmentId: "appointment-id-1",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(concluido);
  });
});
