import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { WorkingHoursRepository } from "./workingHours.repository";
import { limparBanco, prismaClient } from "../../../test-integration/database";

// Teste de INTEGRAÇÃO: roda contra o Postgres de teste (npm run test:int).
// Foco: o updateWorkingHours atualiza vários dias numa transação.
// Ou todos os dias mudam, ou nenhum muda.

const repository = new WorkingHoursRepository();

async function criarDia(dayOfWeek: number) {
  return prismaClient.workingHours.create({
    data: {
      dayOfWeek,
      start_time: "08:00",
      end_time: "18:00",
      break_start: "12:00",
      break_end: "13:00",
      isOpen: true,
    },
  });
}

beforeEach(async () => {
  await limparBanco();
  await criarDia(0);
  await criarDia(1);
});

afterAll(async () => {
  await prismaClient.$disconnect();
});

describe("WorkingHoursRepository.findAllWorkingHours", () => {
  it("devolve todos os dias em ordem de domingo (0) a sábado (6)", async () => {
    await criarDia(6);
    await criarDia(3);

    const dias = await repository.findAllWorkingHours();

    expect(dias.map((dia) => dia.dayOfWeek)).toEqual([0, 1, 3, 6]);
  });
});

describe("WorkingHoursRepository.updateWorkingHours", () => {
  it("atualiza todos os dias enviados", async () => {
    await repository.updateWorkingHours([
      { day: 0, start_time: "09:00", end_time: "12:00", isOpen: false },
      { day: 1, start_time: "10:00", end_time: "19:00", isOpen: true },
    ]);

    const domingo = await repository.findWorkingHoursOfDay(0);
    const segunda = await repository.findWorkingHoursOfDay(1);
    expect(domingo).toMatchObject({ start_time: "09:00", end_time: "12:00", isOpen: false });
    expect(segunda).toMatchObject({ start_time: "10:00", end_time: "19:00", isOpen: true });
  });

  it("apaga a pausa quando ela não é enviada", async () => {
    await repository.updateWorkingHours([
      { day: 1, start_time: "08:00", end_time: "18:00", isOpen: true },
    ]);

    const segunda = await repository.findWorkingHoursOfDay(1);
    expect(segunda).toMatchObject({ break_start: null, break_end: null });
  });

  it("não muda nenhum dia se um deles falhar (tudo ou nada)", async () => {
    // o dia 5 não existe no banco: o update dele falha e desfaz a transação inteira
    await expect(
      repository.updateWorkingHours([
        { day: 1, start_time: "10:00", end_time: "19:00", isOpen: true },
        { day: 5, start_time: "10:00", end_time: "19:00", isOpen: true },
      ]),
    ).rejects.toThrow();

    const segunda = await repository.findWorkingHoursOfDay(1);
    expect(segunda?.start_time).toBe("08:00");
  });
});
