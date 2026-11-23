import { beforeEach, describe, expect, it, vi } from "vitest";

import { ScheduleBlocksService } from "./scheduleBlocks.service";
import type { ScheduleBlocksRepository } from "./scheduleBlocks.repository";
import type { AppointmentRepository } from "../appointments/appointment.repository";
import { BadRequestError, NotFoundError } from "../../errors/app-error";

// Testes unitários do ScheduleBlocksService: os dois repositories são mockados.

const scheduleBlocksRepository = {
  findConflictingScheduleBlock: vi.fn(),
  createNewScheduleBlock: vi.fn(),
  findScheduleBlockById: vi.fn(),
  findScheduleBlocksInPeriod: vi.fn(),
  updateScheduleBlock: vi.fn(),
  deleteScheduleBlock: vi.fn(),
};
const appointmentRepository = {
  findConflictingAppointment: vi.fn(),
};

const service = new ScheduleBlocksService(
  scheduleBlocksRepository as unknown as ScheduleBlocksRepository,
  appointmentRepository as unknown as AppointmentRepository,
);

const dados = {
  start_time: new Date("2099-01-05T11:00:00.000Z"),
  end_time: new Date("2099-01-05T21:00:00.000Z"),
  reason: "Feriado",
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("ScheduleBlocksService.createScheduleBlock", () => {
  it("cria o bloqueio quando não há bloqueio nem agendamento no período", async () => {
    const bloqueio = { id: "block-1", ...dados, createdAt: new Date() };
    scheduleBlocksRepository.findConflictingScheduleBlock.mockResolvedValue([]);
    appointmentRepository.findConflictingAppointment.mockResolvedValue(null);
    scheduleBlocksRepository.createNewScheduleBlock.mockResolvedValue(bloqueio);

    const resultado = await service.createScheduleBlock(dados);

    expect(resultado).toEqual(bloqueio);
    expect(scheduleBlocksRepository.findConflictingScheduleBlock).toHaveBeenCalledWith({
      start_time: dados.start_time,
      end_time: dados.end_time,
    });
    expect(appointmentRepository.findConflictingAppointment).toHaveBeenCalledWith({
      start_time: dados.start_time,
      end_time: dados.end_time,
    });
    expect(scheduleBlocksRepository.createNewScheduleBlock).toHaveBeenCalledWith(dados);
    expect(scheduleBlocksRepository.createNewScheduleBlock).toHaveBeenCalledTimes(1);
  });

  it("lança BadRequestError e não cria quando já existe bloqueio no período", async () => {
    scheduleBlocksRepository.findConflictingScheduleBlock.mockResolvedValue([
      { id: "block-existente" },
    ]);
    appointmentRepository.findConflictingAppointment.mockResolvedValue(null);

    await expect(service.createScheduleBlock(dados)).rejects.toBeInstanceOf(
      BadRequestError,
    );
    expect(scheduleBlocksRepository.createNewScheduleBlock).not.toHaveBeenCalled();
  });

  it("lança BadRequestError e não cria quando já existe agendamento no período", async () => {
    scheduleBlocksRepository.findConflictingScheduleBlock.mockResolvedValue([]);
    appointmentRepository.findConflictingAppointment.mockResolvedValue({
      id: "appointment-id-1",
    });

    await expect(service.createScheduleBlock(dados)).rejects.toThrow(
      "Já existe algum bloqueio ou agendamento para a data selecionada.",
    );
    expect(scheduleBlocksRepository.createNewScheduleBlock).not.toHaveBeenCalled();
  });
});

describe("ScheduleBlocksService.listScheduleBlocks", () => {
  it("converte o período para o fuso do salão, incluindo o último dia inteiro", async () => {
    const lista = [{ id: "block-1" }];
    scheduleBlocksRepository.findScheduleBlocksInPeriod.mockResolvedValue(lista);

    const resultado = await service.listScheduleBlocks("2026-10-12", "2026-10-13");

    expect(resultado).toEqual(lista);
    expect(scheduleBlocksRepository.findScheduleBlocksInPeriod).toHaveBeenCalledWith({
      start_time: new Date("2026-10-12T03:00:00.000Z"),
      end_time: new Date("2026-10-14T03:00:00.000Z"),
    });
  });
});

describe("ScheduleBlocksService.updateScheduleBlock", () => {
  const edicao = { id: "block-1", ...dados };

  it("lança NotFoundError e não edita quando o bloqueio não existe", async () => {
    scheduleBlocksRepository.findScheduleBlockById.mockResolvedValue(null);

    await expect(service.updateScheduleBlock(edicao)).rejects.toThrow(
      new NotFoundError("Bloqueio não encontrado"),
    );
    expect(scheduleBlocksRepository.updateScheduleBlock).not.toHaveBeenCalled();
  });

  it("confere conflito com OUTROS bloqueios, ignorando o próprio", async () => {
    scheduleBlocksRepository.findScheduleBlockById.mockResolvedValue({ id: "block-1" });
    scheduleBlocksRepository.findConflictingScheduleBlock.mockResolvedValue([]);
    appointmentRepository.findConflictingAppointment.mockResolvedValue(null);
    scheduleBlocksRepository.updateScheduleBlock.mockResolvedValue({ id: "block-1" });

    await service.updateScheduleBlock(edicao);

    expect(scheduleBlocksRepository.findConflictingScheduleBlock).toHaveBeenCalledWith({
      start_time: dados.start_time,
      end_time: dados.end_time,
      excludeId: "block-1",
    });
  });

  it.each([
    ["outro bloqueio", [{ id: "block-2" }], null],
    ["um agendamento", [], { id: "appointment-id-1" }],
  ])("lança BadRequestError e não edita quando o novo período bate com %s", async (_caso, blocos, agendamento) => {
    scheduleBlocksRepository.findScheduleBlockById.mockResolvedValue({ id: "block-1" });
    scheduleBlocksRepository.findConflictingScheduleBlock.mockResolvedValue(blocos);
    appointmentRepository.findConflictingAppointment.mockResolvedValue(agendamento);

    await expect(service.updateScheduleBlock(edicao)).rejects.toThrow(
      new BadRequestError("Já existe algum bloqueio ou agendamento para a data selecionada."),
    );
    expect(scheduleBlocksRepository.updateScheduleBlock).not.toHaveBeenCalled();
  });

  it("edita e devolve o bloqueio atualizado", async () => {
    const atualizado = { id: "block-1", ...dados, reason: "Reforma" };
    scheduleBlocksRepository.findScheduleBlockById.mockResolvedValue({ id: "block-1" });
    scheduleBlocksRepository.findConflictingScheduleBlock.mockResolvedValue([]);
    appointmentRepository.findConflictingAppointment.mockResolvedValue(null);
    scheduleBlocksRepository.updateScheduleBlock.mockResolvedValue(atualizado);

    const resultado = await service.updateScheduleBlock({ ...edicao, reason: "Reforma" });

    expect(resultado).toEqual(atualizado);
    expect(scheduleBlocksRepository.updateScheduleBlock).toHaveBeenCalledWith({
      ...edicao,
      reason: "Reforma",
    });
    expect(scheduleBlocksRepository.updateScheduleBlock).toHaveBeenCalledTimes(1);
  });
});

describe("ScheduleBlocksService.deleteScheduleBlock", () => {
  it("lança NotFoundError e não remove quando o bloqueio não existe", async () => {
    scheduleBlocksRepository.findScheduleBlockById.mockResolvedValue(null);

    await expect(service.deleteScheduleBlock({ id: "nao-existe" })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(scheduleBlocksRepository.deleteScheduleBlock).not.toHaveBeenCalled();
  });

  it("remove e devolve o bloqueio removido", async () => {
    const bloqueio = { id: "block-1", ...dados };
    scheduleBlocksRepository.findScheduleBlockById.mockResolvedValue(bloqueio);
    scheduleBlocksRepository.deleteScheduleBlock.mockResolvedValue(bloqueio);

    await expect(service.deleteScheduleBlock({ id: "block-1" })).resolves.toEqual(bloqueio);
    expect(scheduleBlocksRepository.deleteScheduleBlock).toHaveBeenCalledWith("block-1");
  });
});
