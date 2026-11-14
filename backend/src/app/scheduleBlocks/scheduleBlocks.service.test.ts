import { beforeEach, describe, expect, it, vi } from "vitest";

import { ScheduleBlocksService } from "./scheduleBlocks.service";
import type { ScheduleBlocksRepository } from "./scheduleBlocks.repository";
import type { AppointmentRepository } from "../appointments/appointment.repository";
import { BadRequestError } from "../../errors/app-error";

// Testes unitários do ScheduleBlocksService: os dois repositories são mockados.

const scheduleBlocksRepository = {
  findConflictingScheduleBlock: vi.fn(),
  createNewScheduleBlock: vi.fn(),
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
