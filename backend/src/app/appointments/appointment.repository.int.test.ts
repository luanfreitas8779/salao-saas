import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { AppointmentRepository } from "./appointment.repository";
import { ConflictError } from "../../errors/app-error";
import {
  criarProcedimento,
  criarUsuario,
  limparBanco,
  prismaClient,
} from "../../../test-integration/database";

// Teste de INTEGRAÇÃO: roda contra o Postgres de teste (npm run test:int).
// Aqui a constraint appointments_no_overlap é a de verdade, não um mock.

const repository = new AppointmentRepository();

// horário fixo bem no futuro, para nunca depender do relógio da máquina
function horario(hora: string) {
  return new Date(`2099-01-05T${hora}:00.000Z`);
}

let clienteId: string;
let procedimentoId: string;

function dadosDoAgendamento(inicio: string, fim: string) {
  return {
    start_time: horario(inicio),
    end_time: horario(fim),
    client_id: clienteId,
    procedure_id: procedimentoId,
  };
}

beforeEach(async () => {
  await limparBanco();
  clienteId = (await criarUsuario()).id;
  procedimentoId = (await criarProcedimento()).id;
});

afterAll(async () => {
  await prismaClient.$disconnect();
});

describe("AppointmentRepository.createAppointment (constraint de sobreposição)", () => {
  it("grava o agendamento e devolve com procedimento e cliente", async () => {
    const criado = await repository.createAppointment(dadosDoAgendamento("12:00", "13:00"));

    expect(criado).toMatchObject({
      client_id: clienteId,
      status: "SCHEDULED",
      procedure: { id: procedimentoId },
      client: { id: clienteId },
    });
  });

  it("recusa com ConflictError um agendamento que se sobrepõe a outro", async () => {
    await repository.createAppointment(dadosDoAgendamento("12:00", "13:00"));

    await expect(
      repository.createAppointment(dadosDoAgendamento("12:30", "13:30")),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(await prismaClient.appointments.count()).toBe(1);
  });

  it("recusa um agendamento que fica inteiro dentro de outro", async () => {
    await repository.createAppointment(dadosDoAgendamento("12:00", "14:00"));

    await expect(
      repository.createAppointment(dadosDoAgendamento("12:30", "13:00")),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("aceita um agendamento encostado: o intervalo é [início, fim)", async () => {
    await repository.createAppointment(dadosDoAgendamento("12:00", "13:00"));

    await expect(
      repository.createAppointment(dadosDoAgendamento("13:00", "14:00")),
    ).resolves.toBeDefined();
    expect(await prismaClient.appointments.count()).toBe(2);
  });

  it("aceita um agendamento por cima de um cancelado (cancelado não ocupa horário)", async () => {
    const cancelado = await repository.createAppointment(dadosDoAgendamento("12:00", "13:00"));
    await repository.cancelAppointment(cancelado.id);

    await expect(
      repository.createAppointment(dadosDoAgendamento("12:00", "13:00")),
    ).resolves.toBeDefined();
  });

  it("de dois pedidos sobrepostos ao mesmo tempo, grava exatamente um", async () => {
    // a race condition: os dois pedidos saem juntos, sem esperar um pelo outro.
    // Repete 10 vezes porque um teste de concorrência rodado uma vez pode passar por sorte.
    for (let rodada = 0; rodada < 10; rodada++) {
      await limparBanco();
      clienteId = (await criarUsuario()).id;
      procedimentoId = (await criarProcedimento()).id;

      const resultados = await Promise.allSettled([
        repository.createAppointment(dadosDoAgendamento("12:00", "13:00")),
        repository.createAppointment(dadosDoAgendamento("12:30", "13:30")),
      ]);

      const gravados = resultados.filter((r) => r.status === "fulfilled");
      const conflitos = resultados.filter(
        (r) => r.status === "rejected" && r.reason instanceof ConflictError,
      );
      expect(gravados).toHaveLength(1);
      expect(conflitos).toHaveLength(1);
    }
  });
});

describe("AppointmentRepository.updateAppointment (constraint de sobreposição)", () => {
  it("recusa com ConflictError mover um agendamento para cima de outro", async () => {
    await repository.createAppointment(dadosDoAgendamento("12:00", "13:00"));
    const outro = await repository.createAppointment(dadosDoAgendamento("15:00", "16:00"));

    await expect(
      repository.updateAppointment({
        id: outro.id,
        procedure_id: procedimentoId,
        start_time: horario("12:30"),
        end_time: horario("13:30"),
      }),
    ).rejects.toBeInstanceOf(ConflictError);

    // o agendamento recusado continua no horário antigo
    const semMudanca = await prismaClient.appointments.findUnique({ where: { id: outro.id } });
    expect(semMudanca?.start_time).toEqual(horario("15:00"));
  });

  it("aceita alterar um agendamento no próprio horário (ele não conflita com ele mesmo)", async () => {
    const agendamento = await repository.createAppointment(dadosDoAgendamento("12:00", "13:00"));

    const editado = await repository.updateAppointment({
      id: agendamento.id,
      procedure_id: procedimentoId,
      start_time: horario("12:00"),
      end_time: horario("13:00"),
      observation: "Nova observação",
    });

    expect(editado.observation).toBe("Nova observação");
  });
});

describe("AppointmentRepository consultas por período", () => {
  it("getAppointmentsOnDay traz só os não cancelados do período, em ordem de início", async () => {
    await repository.createAppointment(dadosDoAgendamento("15:00", "16:00"));
    await repository.createAppointment(dadosDoAgendamento("09:00", "10:00"));
    const cancelado = await repository.createAppointment(dadosDoAgendamento("11:00", "12:00"));
    await repository.cancelAppointment(cancelado.id);
    // outro dia: não pode aparecer
    await repository.createAppointment({
      ...dadosDoAgendamento("09:00", "10:00"),
      start_time: new Date("2099-01-06T09:00:00.000Z"),
      end_time: new Date("2099-01-06T10:00:00.000Z"),
    });

    const doDia = await repository.getAppointmentsOnDay({
      startDay: new Date("2099-01-05T00:00:00.000Z"),
      endDay: new Date("2099-01-06T00:00:00.000Z"),
    });

    expect(doDia).toEqual([
      { start_time: horario("09:00"), end_time: horario("10:00") },
      { start_time: horario("15:00"), end_time: horario("16:00") },
    ]);
  });

  it("findConflictingAppointment acha o sobreposto e ignora o id informado em excludeId", async () => {
    const existente = await repository.createAppointment(dadosDoAgendamento("12:00", "13:00"));

    const conflito = await repository.findConflictingAppointment({
      start_time: horario("12:30"),
      end_time: horario("13:30"),
    });
    const ignorandoEle = await repository.findConflictingAppointment({
      start_time: horario("12:30"),
      end_time: horario("13:30"),
      excludeId: existente.id,
    });

    expect(conflito?.id).toBe(existente.id);
    expect(ignorandoEle).toBeNull();
  });
});

describe("AppointmentRepository.completeAppointment", () => {
  it("marca como COMPLETED e o horário continua ocupado", async () => {
    const agendamento = await repository.createAppointment(dadosDoAgendamento("12:00", "13:00"));

    const concluido = await repository.completeAppointment(agendamento.id);

    expect(concluido.status).toBe("COMPLETED");
    // um agendamento concluído continua ocupando o horário (só CANCELLED libera)
    await expect(
      repository.createAppointment(dadosDoAgendamento("12:00", "13:00")),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("AppointmentRepository.findByClientId (paginação)", () => {
  it("devolve a página pedida, do mais recente para o mais antigo, e o total", async () => {
    for (const hora of ["08:00", "10:00", "12:00", "14:00", "16:00"]) {
      const [h, m] = hora.split(":");
      await repository.createAppointment(
        dadosDoAgendamento(hora, `${String(Number(h) + 1).padStart(2, "0")}:${m}`),
      );
    }

    const pagina = await repository.findByClientId(clienteId, { skip: 2, take: 2 });

    expect(pagina.total).toBe(5);
    expect(pagina.items.map((a) => a.start_time)).toEqual([horario("12:00"), horario("10:00")]);
  });
});
