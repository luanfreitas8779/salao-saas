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
