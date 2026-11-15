import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppointmentRepository } from "./appointment.repository";
import prismaClient from "../../prisma";
import { ConflictError } from "../../errors/app-error";

// Quem impede a sobreposição é a constraint appointments_no_overlap, no banco.
// Este teste NÃO prova a constraint (o Prisma aqui é falso): ele prova que o
// repository traduz o erro do banco (23P01) para ConflictError e deixa
// qualquer outro erro passar sem mudança.

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
});
