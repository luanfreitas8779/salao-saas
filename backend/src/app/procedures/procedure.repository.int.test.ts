import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { ProcedureRepository } from "./procedure.repository";
import { ConflictError } from "../../errors/app-error";
import {
  criarProcedimento,
  limparBanco,
  prismaClient,
} from "../../../test-integration/database";

// Teste de INTEGRAÇÃO: roda contra o Postgres de teste (npm run test:int).
// Foco: o editProcedure, que usa uma transação para não repetir nome,
// e os filtros de ativo/inativo feitos pelo banco.

const repository = new ProcedureRepository();

const novosDados = {
  description: "Nova descrição",
  price: 9000,
  duration_minutes: 90,
};

beforeEach(async () => {
  await limparBanco();
});

afterAll(async () => {
  await prismaClient.$disconnect();
});

describe("ProcedureRepository.editProcedure", () => {
  it("recusa com ConflictError um nome que já pertence a outro procedimento, sem alterar nada", async () => {
    await criarProcedimento({ name: "Corte feminino" });
    const outro = await criarProcedimento({ name: "Escova" });

    await expect(
      repository.editProcedure({ id: outro.id, name: "Corte feminino", ...novosDados }),
    ).rejects.toBeInstanceOf(ConflictError);

    // a transação foi desfeita: o procedimento continua como estava
    const semMudanca = await prismaClient.procedures.findUnique({ where: { id: outro.id } });
    expect(semMudanca).toMatchObject({ name: "Escova", price: 8000 });
  });

  it("deixa manter o próprio nome (o nome só conflita com OUTRO procedimento)", async () => {
    const procedimento = await criarProcedimento({ name: "Corte feminino" });

    const editado = await repository.editProcedure({
      id: procedimento.id,
      name: "Corte feminino",
      ...novosDados,
    });

    expect(editado).toMatchObject({ name: "Corte feminino", price: 9000, duration_minutes: 90 });
  });
});

describe("ProcedureRepository.deleteProcedure / findActiveProcedures / findAllProcedures", () => {
  it("o delete é lógico: desativa e o procedimento continua no banco", async () => {
    const procedimento = await criarProcedimento();

    const desativado = await repository.deleteProcedure({ id: procedimento.id });

    expect(desativado.is_active).toBe(false);
    expect(await prismaClient.procedures.count()).toBe(1);
  });

  it("findActiveProcedures traz só os ativos; findAllProcedures traz todos", async () => {
    const ativo = await criarProcedimento({ name: "Ativo" });
    await criarProcedimento({ name: "Inativo", is_active: false });

    const ativos = await repository.findActiveProcedures();
    const todos = await repository.findAllProcedures();

    expect(ativos.map((p) => p.id)).toEqual([ativo.id]);
    expect(todos).toHaveLength(2);
  });
});

describe("ProcedureRepository.findProcedureByName", () => {
  it("acha pelo nome exato e devolve null quando não existe", async () => {
    const procedimento = await criarProcedimento({ name: "Corte feminino" });

    await expect(
      repository.findProcedureByName({ name: "Corte feminino" }),
    ).resolves.toMatchObject({ id: procedimento.id });
    await expect(repository.findProcedureByName({ name: "Não existe" })).resolves.toBeNull();
  });
});
