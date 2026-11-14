import { beforeEach, describe, expect, it, vi, type Mocked } from "vitest";

import { ProcedureService } from "./procedure.service";
import type { IProcedureRepository, Procedure } from "./IProcedure.repository";
import { ConflictError, NotFoundError } from "../../errors/app-error";

// Testes unitários do ProcedureService. O repository é um mock que segue a
// IProcedureRepository: se a interface mudar, o TypeScript acusa aqui também.

const repository: Mocked<IProcedureRepository> = {
  findProcedureByName: vi.fn(),
  findProcedureById: vi.fn(),
  createProcedure: vi.fn(),
  deleteProcedure: vi.fn(),
  editProcedure: vi.fn(),
  findAllProcedures: vi.fn(),
  findActiveProcedures: vi.fn(),
};

// sem cast: o service pede a interface e o mock cumpre a interface
const service = new ProcedureService(repository);

function criarProcedimento(sobrescrever: Partial<Procedure> = {}): Procedure {
  return {
    id: "procedure-id-1",
    name: "Corte feminino",
    description: "Corte com lavagem",
    price: 8000,
    duration_minutes: 60,
    is_active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...sobrescrever,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("ProcedureService.createProcedure", () => {
  const dados = {
    name: "Corte feminino",
    description: "Corte com lavagem",
    price: 8000,
    duration_minutes: 60,
  };

  it("cria o procedimento quando não existe outro com o mesmo nome", async () => {
    const procedimento = criarProcedimento();
    repository.findProcedureByName.mockResolvedValue(null);
    repository.createProcedure.mockResolvedValue(procedimento);

    const resultado = await service.createProcedure(dados);

    expect(resultado).toEqual(procedimento);
    expect(repository.findProcedureByName).toHaveBeenCalledWith({
      name: dados.name,
    });
    expect(repository.createProcedure).toHaveBeenCalledWith(dados);
    expect(repository.findProcedureByName).toHaveBeenCalledTimes(1);
    expect(repository.createProcedure).toHaveBeenCalledTimes(1)
  })

  it("lança ConflictError e não cria quando o nome já existe", async () => {
    repository.findProcedureByName.mockResolvedValue(criarProcedimento());

    const promise = service.createProcedure(dados);

    await expect(promise).rejects.toBeInstanceOf(ConflictError);
    await expect(promise).rejects.toThrow(
      "O procedimento Corte feminino já existe!",
    );
    expect(repository.createProcedure).not.toHaveBeenCalled();
  });
});

describe("ProcedureService.deleteProcedure", () => {
  it("desativa o procedimento quando ele existe", async () => {
    const desativado = criarProcedimento({ is_active: false });
    repository.findProcedureById.mockResolvedValue(criarProcedimento());
    repository.deleteProcedure.mockResolvedValue(desativado);

    const resultado = await service.deleteProcedure({ id: "procedure-id-1" });

    expect(resultado.is_active).toBe(false);
    expect(repository.deleteProcedure).toHaveBeenCalledWith({
      id: "procedure-id-1",
    });
    expect(repository.deleteProcedure).toHaveBeenCalledTimes(1)
  });

  it("lança NotFoundError e não desativa quando o procedimento não existe", async () => {
    repository.findProcedureById.mockResolvedValue(null);

    await expect(
      service.deleteProcedure({ id: "nao-existe" }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(repository.deleteProcedure).not.toHaveBeenCalled();
  });
});

describe("ProcedureService.editProcedure", () => {
  const dados = {
    id: "procedure-id-1",
    name: "Corte masculino",
    description: "Corte simples",
    price: 5000,
    duration_minutes: 30,
  };

  it("edita o procedimento quando ele existe", async () => {
    const editado = criarProcedimento(dados);
    repository.findProcedureById.mockResolvedValue(criarProcedimento());
    repository.editProcedure.mockResolvedValue(editado);

    const resultado = await service.editProcedure(dados);

    expect(resultado).toEqual(editado);
    expect(repository.editProcedure).toHaveBeenCalledWith(dados);
  });

  it("repassa o ConflictError quando o nome já pertence a outro procedimento", async () => {
    repository.findProcedureById.mockResolvedValue(criarProcedimento());
    repository.editProcedure.mockRejectedValue(
      new ConflictError("O procedimento Corte masculino já existe!"),
    );

    const promise = service.editProcedure(dados);

    await expect(promise).rejects.toBeInstanceOf(ConflictError);
    await expect(promise).rejects.toThrow(
      "O procedimento Corte masculino já existe!",
    );
  });

  it("lança NotFoundError e não edita quando o procedimento não existe", async () => {
    repository.findProcedureById.mockResolvedValue(null);

    await expect(service.editProcedure(dados)).rejects.toThrow(
      "Procedimento não encontrado, atualize a página e tente novamente!",
    );
    expect(repository.editProcedure).not.toHaveBeenCalled();
  });
});

describe("ProcedureService.findAllProcedures / findActiveProcedures", () => {
  it("devolve todos os procedimentos, inclusive os inativos", async () => {
    const lista = [
      criarProcedimento(),
      criarProcedimento({ id: "procedure-id-2", is_active: false }),
    ];
    repository.findAllProcedures.mockResolvedValue(lista);

    await expect(service.findAllProcedures()).resolves.toEqual(lista);
  });

  it("devolve só o que o repository retorna como ativo", async () => {
    const lista = [criarProcedimento()];
    repository.findActiveProcedures.mockResolvedValue(lista);

    await expect(service.findActiveProcedures()).resolves.toEqual(lista);
    expect(repository.findAllProcedures).not.toHaveBeenCalled();
  });
});
