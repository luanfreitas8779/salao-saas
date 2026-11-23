import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppointmentRepository } from "./appointment.repository";
import prismaClient from "../../prisma";
import { ConflictError } from "../../errors/app-error";

// Quem impede a sobreposição é a constraint appointments_no_overlap, no banco.
// Este teste NÃO prova a constraint (o Prisma aqui é falso): ele prova que o
// repository traduz o erro do banco (23P01) para ConflictError, repete a
// gravação após um deadlock (40P01) e deixa qualquer outro erro passar.
// A constraint de verdade é testada no appointment.repository.int.test.ts.

vi.mock("../../prisma", () => ({
  default: {
    appointments: { create: vi.fn(), update: vi.fn() },
  },
}));

const create = vi.mocked(prismaClient.appointments.create);
const update = vi.mocked(prismaClient.appointments.update);

const repository = new AppointmentRepository();

// formato real do erro, observado no Postgres com o @prisma/adapter-pg
function erroDoBanco(code: string) {
  return Object.assign(new Error("mensagem no idioma do Postgres"), {
    cause: { code },
  });
}

const novoAgendamento = {
  start_time: new Date("2099-01-05T12:00:00.000Z"),
  end_time: new Date("2099-01-05T13:00:00.000Z"),
  client_id: "client-id-1",
  procedure_id: "procedure-id-1",
};

const edicao = { id: "appointment-id-1", ...novoAgendamento };

beforeEach(() => {
  vi.resetAllMocks();
});

describe("AppointmentRepository.createAppointment", () => {
  it("devolve o agendamento criado", async () => {
    create.mockResolvedValue({ id: "appointment-id-1" } as never);

    await expect(repository.createAppointment(novoAgendamento)).resolves.toEqual({
      id: "appointment-id-1",
    });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("traduz a violação da constraint de sobreposição (23P01) para ConflictError", async () => {
    create.mockRejectedValue(erroDoBanco("23P01"));

    await expect(repository.createAppointment(novoAgendamento)).rejects.toThrow(
      new ConflictError(
        "Erro: Já existe um agendamento neste horário, atualize a página e tente novamente!",
      ),
    );
  });

  it("deixa passar sem mudança qualquer outro erro do banco", async () => {
    const chaveEstrangeira = erroDoBanco("23503");
    create.mockRejectedValue(chaveEstrangeira);

    await expect(repository.createAppointment(novoAgendamento)).rejects.toBe(
      chaveEstrangeira,
    );
    expect(create).toHaveBeenCalledTimes(1); // erro comum não é repetido
  });

  // Deadlock (40P01): duas gravações simultâneas esperam uma pela outra e o
  // Postgres cancela uma. A cancelada é repetida, e na repetição o resultado
  // volta a ser o normal.
  it("repete a gravação após um deadlock e devolve o agendamento se ela passar", async () => {
    create
      .mockRejectedValueOnce(erroDoBanco("40P01"))
      .mockResolvedValueOnce({ id: "appointment-id-1" } as never);

    await expect(repository.createAppointment(novoAgendamento)).resolves.toEqual({
      id: "appointment-id-1",
    });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("repete após um deadlock e lança ConflictError se a repetição achar o horário ocupado", async () => {
    create
      .mockRejectedValueOnce(erroDoBanco("40P01"))
      .mockRejectedValueOnce(erroDoBanco("23P01"));

    await expect(repository.createAppointment(novoAgendamento)).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("desiste depois de 3 tentativas com deadlock e deixa o erro passar", async () => {
    const deadlock = erroDoBanco("40P01");
    create.mockRejectedValue(deadlock);

    await expect(repository.createAppointment(novoAgendamento)).rejects.toBe(deadlock);
    expect(create).toHaveBeenCalledTimes(3);
  });
});

describe("AppointmentRepository.updateAppointment", () => {
  it("traduz a violação da constraint de sobreposição (23P01) para ConflictError", async () => {
    update.mockRejectedValue(erroDoBanco("23P01"));

    await expect(repository.updateAppointment(edicao)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("deixa passar sem mudança qualquer outro erro do banco", async () => {
    const erro = new Error("conexão caiu");
    update.mockRejectedValue(erro);

    await expect(repository.updateAppointment(edicao)).rejects.toBe(erro);
  });

  it("repete a edição após um deadlock", async () => {
    update
      .mockRejectedValueOnce(erroDoBanco("40P01"))
      .mockResolvedValueOnce({ id: "appointment-id-1" } as never);

    await expect(repository.updateAppointment(edicao)).resolves.toEqual({
      id: "appointment-id-1",
    });
    expect(update).toHaveBeenCalledTimes(2);
  });
});

// O formato do erro muda entre versões do Prisma. Os dois abaixo foram
// capturados do Postgres de verdade:
//   - Prisma 7.8:  Error com o código em error.cause.code
//   - Prisma 7.10: PrismaClientKnownRequestError (P2039) com o código em
//                  error.meta.driverAdapterError.cause.code
function erroDoBancoPrisma710(code: string) {
  return Object.assign(new Error("Invalid `prisma.appointments.create()` invocation"), {
    code: "P2039",
    meta: {
      modelName: "Appointments",
      driverAdapterError: { name: "DriverAdapterError", cause: { code, kind: "postgres" } },
    },
  });
}

describe("AppointmentRepository: formato do erro do Prisma 7.10", () => {
  it("reconhece a sobreposição (23P01) e lança ConflictError", async () => {
    create.mockRejectedValue(erroDoBancoPrisma710("23P01"));

    await expect(repository.createAppointment(novoAgendamento)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("reconhece o deadlock (40P01) e repete a gravação", async () => {
    create
      .mockRejectedValueOnce(erroDoBancoPrisma710("40P01"))
      .mockResolvedValueOnce({ id: "appointment-id-1" } as never);

    await expect(repository.createAppointment(novoAgendamento)).resolves.toEqual({
      id: "appointment-id-1",
    });
    expect(create).toHaveBeenCalledTimes(2);
  });
});

describe("AppointmentRepository: deadlock no formato do Prisma 7.10", () => {
  // capturado do Postgres de verdade: no deadlock o Prisma 7.10 classifica o erro
  // como TransactionWriteConflict (P2034) e só manda o originalCode, sem o code
  it("reconhece o deadlock pelo originalCode e repete a gravação", async () => {
    const deadlock = Object.assign(new Error("Transaction failed due to a write conflict or a deadlock"), {
      code: "P2034",
      meta: {
        modelName: "Appointments",
        driverAdapterError: {
          name: "DriverAdapterError",
          cause: { originalCode: "40P01", kind: "TransactionWriteConflict" },
        },
      },
    });
    create
      .mockRejectedValueOnce(deadlock)
      .mockRejectedValueOnce(erroDoBancoPrisma710("23P01"));

    await expect(repository.createAppointment(novoAgendamento)).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(create).toHaveBeenCalledTimes(2);
  });
});
