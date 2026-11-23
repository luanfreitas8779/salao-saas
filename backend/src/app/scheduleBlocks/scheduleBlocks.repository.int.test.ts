import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { ScheduleBlocksRepository } from "./scheduleBlocks.repository";
import { limparBanco, prismaClient } from "../../../test-integration/database";

// Teste de INTEGRAÇÃO: roda contra o Postgres de teste (npm run test:int).
// Foco: a regra de sobreposição da consulta (início < fim do outro E fim > início do outro).

const repository = new ScheduleBlocksRepository();

function horario(hora: string) {
  return new Date(`2099-01-05T${hora}:00.000Z`);
}

beforeEach(async () => {
  await limparBanco();
  // bloqueio existente: 12:00–14:00
  await repository.createNewScheduleBlock({
    start_time: horario("12:00"),
    end_time: horario("14:00"),
    reason: "Consulta médica",
  });
});

afterAll(async () => {
  await prismaClient.$disconnect();
});

describe("ScheduleBlocksRepository.findConflictingScheduleBlock", () => {
  it.each([
    ["começa antes e termina dentro", "11:00", "12:30", 1],
    ["fica inteiro dentro", "12:30", "13:30", 1],
    ["começa dentro e termina depois", "13:30", "15:00", 1],
    ["cobre o bloqueio inteiro", "11:00", "15:00", 1],
    ["termina quando o bloqueio começa (encostado)", "11:00", "12:00", 0],
    ["começa quando o bloqueio termina (encostado)", "14:00", "15:00", 0],
    ["fica todo antes", "08:00", "09:00", 0],
  ])("período que %s → %i bloqueio(s)", async (_caso, inicio, fim, quantidade) => {
    const conflitos = await repository.findConflictingScheduleBlock({
      start_time: horario(inicio),
      end_time: horario(fim),
    });

    expect(conflitos).toHaveLength(quantidade);
  });
});

describe("ScheduleBlocksRepository: buscar, listar, editar e remover", () => {
  async function bloqueioExistente() {
    const [bloqueio] = await repository.findConflictingScheduleBlock({
      start_time: horario("12:00"),
      end_time: horario("14:00"),
    });
    return bloqueio!;
  }

  it("findConflictingScheduleBlock ignora o bloqueio informado em excludeId", async () => {
    const existente = await bloqueioExistente();

    const conflitos = await repository.findConflictingScheduleBlock({
      start_time: horario("12:30"),
      end_time: horario("13:30"),
      excludeId: existente.id,
    });

    expect(conflitos).toEqual([]);
  });

  it("findScheduleBlockById acha pelo id e devolve null quando não existe", async () => {
    const existente = await bloqueioExistente();

    await expect(repository.findScheduleBlockById(existente.id)).resolves.toMatchObject({
      reason: "Consulta médica",
    });
    await expect(
      repository.findScheduleBlockById("3f1c9a52-8c4e-4f7a-9d2b-6a1e5c7b8d90"),
    ).resolves.toBeNull();
  });

  it("findScheduleBlocksInPeriod traz os bloqueios do período em ordem de início", async () => {
    await repository.createNewScheduleBlock({
      start_time: horario("08:00"),
      end_time: horario("09:00"),
      reason: "Antes",
    });
    // outro dia: não pode aparecer
    await repository.createNewScheduleBlock({
      start_time: new Date("2099-01-07T12:00:00.000Z"),
      end_time: new Date("2099-01-07T13:00:00.000Z"),
      reason: "Outro dia",
    });

    const doDia = await repository.findScheduleBlocksInPeriod({
      start_time: new Date("2099-01-05T00:00:00.000Z"),
      end_time: new Date("2099-01-06T00:00:00.000Z"),
    });

    expect(doDia.map((b) => b.reason)).toEqual(["Antes", "Consulta médica"]);
  });

  it("updateScheduleBlock grava o novo período e o novo motivo", async () => {
    const existente = await bloqueioExistente();

    const editado = await repository.updateScheduleBlock({
      id: existente.id,
      start_time: horario("15:00"),
      end_time: horario("16:00"),
      reason: "Reunião",
    });

    expect(editado).toMatchObject({
      start_time: horario("15:00"),
      end_time: horario("16:00"),
      reason: "Reunião",
    });
  });

  it("deleteScheduleBlock remove de verdade e devolve o removido", async () => {
    const existente = await bloqueioExistente();

    const removido = await repository.deleteScheduleBlock(existente.id);

    expect(removido.id).toBe(existente.id);
    expect(await prismaClient.schedule_blocks.count()).toBe(0);
  });
});
