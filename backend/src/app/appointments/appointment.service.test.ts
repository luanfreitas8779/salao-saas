import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppointmentService } from "./appointment.service";
import type { AppointmentRepository } from "./appointment.repository";
import type { ProcedureRepository } from "../procedures/procedure.repository";
import type { ScheduleBlocksRepository } from "../scheduleBlocks/scheduleBlocks.repository";
import type { WorkingHoursRepository } from "../workingHours/workingHours.repository";
import type { UserRepository } from "../user/user.repository";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "../../errors/app-error";
import { businessDateTime } from "../../utils/businessTime";

// Testes unitários do AppointmentService: os cinco repositories são mockados.
// Regra das datas: nada depende do relógio da máquina.
//   - "futuro" é uma data fixa bem distante (DIA_FUTURO);
//   - "passado" é uma data fixa bem antiga (DIA_PASSADO);
//   - "daqui a X horas" é montado a partir de Date.now().

const appointmentRepository = {
  getAppointmentsOnDay: vi.fn(),
  findById: vi.fn(),
  findByClientId: vi.fn(),
  findBoard: vi.fn(),
  createAppointment: vi.fn(),
  cancelAppointment: vi.fn(),
  updateAppointment: vi.fn(),
};
const procedureRepository = { findProcedureById: vi.fn() };
const scheduleBlocksRepository = { findConflictingScheduleBlock: vi.fn() };
const workingHoursRepository = { findWorkingHoursOfDay: vi.fn() };
const userRepository = { findUserById: vi.fn() };

// a ordem do construtor importa: appointment, procedure, blocks, workingHours, user
const service = new AppointmentService(
  appointmentRepository as unknown as AppointmentRepository,
  procedureRepository as unknown as ProcedureRepository,
  scheduleBlocksRepository as unknown as ScheduleBlocksRepository,
  workingHoursRepository as unknown as WorkingHoursRepository,
  userRepository as unknown as UserRepository,
);

const DIA_FUTURO = "2099-01-05"; // segunda-feira
const DIA_PASSADO = "2000-01-03"; // segunda-feira
const SEGUNDA = 1;
const UMA_HORA = 60 * 60 * 1000;

const CLIENTE_ID = "client-id-1";
const ADMIN_ID = "admin-id-1";
const PROCEDIMENTO_ID = "procedure-id-1";

function horasAPartirDeAgora(horas: number) {
  return new Date(Date.now() + horas * UMA_HORA);
}

function criarProcedimento(sobrescrever: Record<string, unknown> = {}) {
  return {
    id: PROCEDIMENTO_ID,
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

// expediente 08:00–18:00 com pausa 12:00–13:00
function criarExpediente(sobrescrever: Record<string, unknown> = {}) {
  return {
    id: "working-hours-1",
    dayOfWeek: SEGUNDA,
    start_time: "08:00",
    end_time: "18:00",
    break_start: "12:00",
    break_end: "13:00",
    isOpen: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...sobrescrever,
  };
}

function criarAgendamento(sobrescrever: Record<string, unknown> = {}) {
  return {
    id: "appointment-id-1",
    client_id: CLIENTE_ID,
    procedure_id: PROCEDIMENTO_ID,
    start_time: horasAPartirDeAgora(48),
    end_time: horasAPartirDeAgora(49),
    observation: "Observação original",
    status: "SCHEDULED",
    createdAt: new Date(),
    ...sobrescrever,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("AppointmentService.availableTimes", () => {
  it("lança NotFoundError quando o procedimento não existe", async () => {
    procedureRepository.findProcedureById.mockResolvedValue(null);

    await expect(
      service.availableTimes({ procedure_id: "nao-existe", date: DIA_FUTURO }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(workingHoursRepository.findWorkingHoursOfDay).not.toHaveBeenCalled();
  });

  it("lança NotFoundError quando o procedimento está inativo", async () => {
    procedureRepository.findProcedureById.mockResolvedValue(
      criarProcedimento({ is_active: false }),
    );

    await expect(
      service.availableTimes({ procedure_id: PROCEDIMENTO_ID, date: DIA_FUTURO }),
    ).rejects.toThrow("Procedimento não encontrado");
  });

  it("lança BadRequestError quando o salão não abre no dia", async () => {
    procedureRepository.findProcedureById.mockResolvedValue(criarProcedimento());
    workingHoursRepository.findWorkingHoursOfDay.mockResolvedValue(
      criarExpediente({ isOpen: false }),
    );

    await expect(
      service.availableTimes({ procedure_id: PROCEDIMENTO_ID, date: DIA_FUTURO }),
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(appointmentRepository.getAppointmentsOnDay).not.toHaveBeenCalled();
  });

  it("consulta o expediente do dia da semana certo e busca o dia inteiro", async () => {
    procedureRepository.findProcedureById.mockResolvedValue(criarProcedimento());
    workingHoursRepository.findWorkingHoursOfDay.mockResolvedValue(criarExpediente());
    scheduleBlocksRepository.findConflictingScheduleBlock.mockResolvedValue([]);
    appointmentRepository.getAppointmentsOnDay.mockResolvedValue([]);

    await service.availableTimes({ procedure_id: PROCEDIMENTO_ID, date: DIA_FUTURO });

    expect(workingHoursRepository.findWorkingHoursOfDay).toHaveBeenCalledWith(SEGUNDA);
    expect(appointmentRepository.getAppointmentsOnDay).toHaveBeenCalledWith({
      startDay: new Date("2099-01-05T03:00:00.000Z"),
      endDay: new Date("2099-01-06T03:00:00.000Z"),
    });
  });

  it("monta a grade de 30 em 30 minutos, tirando agendamentos e bloqueios", async () => {
    // Cálculo feito à mão (expediente 08:00–12:00, procedimento de 60 min):
    //   08:00 → 09:00  livre
    //   08:30 → 09:30  bate no agendamento 09:00–10:00
    //   09:00 → 10:00  bate no agendamento
    //   09:30 → 10:30  bate no agendamento
    //   10:00 → 11:00  livre
    //   10:30 → 11:30  bate no bloqueio 11:00–11:30
    //   11:00 → 12:00  bate no bloqueio
    //   11:30 → 12:30  passa do fechamento, nem entra na grade
    procedureRepository.findProcedureById.mockResolvedValue(criarProcedimento());
    workingHoursRepository.findWorkingHoursOfDay.mockResolvedValue(
      criarExpediente({ end_time: "12:00", break_start: null, break_end: null }),
    );
    appointmentRepository.getAppointmentsOnDay.mockResolvedValue([
      {
        start_time: businessDateTime(DIA_FUTURO, "09:00"),
        end_time: businessDateTime(DIA_FUTURO, "10:00"),
      },
    ]);
    scheduleBlocksRepository.findConflictingScheduleBlock.mockResolvedValue([
      {
        start_time: businessDateTime(DIA_FUTURO, "11:00"),
        end_time: businessDateTime(DIA_FUTURO, "11:30"),
      },
    ]);

    const horarios = await service.availableTimes({
      procedure_id: PROCEDIMENTO_ID,
      date: DIA_FUTURO,
    });

    expect(horarios).toEqual(["08:00", "10:00"]);
  });

  it("tira da grade os horários que encostam na pausa", async () => {
    // expediente 11:00–14:00, pausa 12:00–13:00, procedimento de 30 min
    //   11:00 e 11:30 livres; 12:00 e 12:30 na pausa; 13:00 e 13:30 livres
    procedureRepository.findProcedureById.mockResolvedValue(
      criarProcedimento({ duration_minutes: 30 }),
    );
    workingHoursRepository.findWorkingHoursOfDay.mockResolvedValue(
      criarExpediente({ start_time: "11:00", end_time: "14:00" }),
    );
    appointmentRepository.getAppointmentsOnDay.mockResolvedValue([]);
    scheduleBlocksRepository.findConflictingScheduleBlock.mockResolvedValue([]);

    const horarios = await service.availableTimes({
      procedure_id: PROCEDIMENTO_ID,
      date: DIA_FUTURO,
    });

    expect(horarios).toEqual(["11:00", "11:30", "13:00", "13:30"]);
  });

  it("não oferece nenhum horário num dia que já passou", async () => {
    procedureRepository.findProcedureById.mockResolvedValue(criarProcedimento());
    workingHoursRepository.findWorkingHoursOfDay.mockResolvedValue(criarExpediente());
    appointmentRepository.getAppointmentsOnDay.mockResolvedValue([]);
    scheduleBlocksRepository.findConflictingScheduleBlock.mockResolvedValue([]);

    const horarios = await service.availableTimes({
      procedure_id: PROCEDIMENTO_ID,
      date: DIA_PASSADO,
    });

    expect(horarios).toEqual([]);
  });
});

describe("AppointmentService.createAppointment", () => {
  const INICIO_VALIDO = businessDateTime(DIA_FUTURO, "09:00").toISOString();

  // deixa todos os mocks no "caminho feliz"; cada teste estraga só o que precisa
  function prepararCaminhoFeliz() {
    procedureRepository.findProcedureById.mockResolvedValue(criarProcedimento());
    workingHoursRepository.findWorkingHoursOfDay.mockResolvedValue(criarExpediente());
    scheduleBlocksRepository.findConflictingScheduleBlock.mockResolvedValue([]);
    appointmentRepository.createAppointment.mockResolvedValue(criarAgendamento());
  }

  it("cria o agendamento para o próprio cliente com o fim calculado pela duração", async () => {
    prepararCaminhoFeliz();

    await service.createAppointment({
      start_time: INICIO_VALIDO,
      observation: "Cabelo longo",
      actor_id: CLIENTE_ID,
      actor_role: "CLIENT",
      procedure_id: PROCEDIMENTO_ID,
    });

    expect(appointmentRepository.createAppointment).toHaveBeenCalledWith({
      start_time: businessDateTime(DIA_FUTURO, "09:00"),
      end_time: businessDateTime(DIA_FUTURO, "10:00"),
      observation: "Cabelo longo",
      client_id: CLIENTE_ID,
      procedure_id: PROCEDIMENTO_ID,
    });
    expect(appointmentRepository.createAppointment).toHaveBeenCalledTimes(1);
  });

  it("busca o papel do usuário no banco quando ele não vem no token", async () => {
    prepararCaminhoFeliz();
    userRepository.findUserById.mockImplementation(async ({ id }: { id: string }) =>
      id === ADMIN_ID ? { id: ADMIN_ID, role: "ADMIN" } : { id, role: "CLIENT" },
    );

    await service.createAppointment({
      start_time: INICIO_VALIDO,
      actor_id: ADMIN_ID,
      procedure_id: PROCEDIMENTO_ID,
      client_id: CLIENTE_ID,
    });

    expect(userRepository.findUserById).toHaveBeenCalledWith({ id: ADMIN_ID });
    expect(appointmentRepository.createAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ client_id: CLIENTE_ID }),
    );
  });

  it.each([
    ["não existe", null],
    ["está inativo", criarProcedimento({ is_active: false })],
  ])("lança NotFoundError e não cria quando o procedimento %s", async (_caso, procedimento) => {
    procedureRepository.findProcedureById.mockResolvedValue(procedimento);

    await expect(
      service.createAppointment({
        start_time: INICIO_VALIDO,
        actor_id: CLIENTE_ID,
        actor_role: "CLIENT",
        procedure_id: PROCEDIMENTO_ID,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(appointmentRepository.createAppointment).not.toHaveBeenCalled();
  });

  it("barra o cliente comum que tenta agendar em nome de outra pessoa", async () => {
    prepararCaminhoFeliz();

    // Atenção: aqui o código lança 401 (UnauthorizedError). No cancelamento,
    // a mesma situação ("mexer no que é de outro") lança 403 (ForbiddenError).
    await expect(
      service.createAppointment({
        start_time: INICIO_VALIDO,
        actor_id: CLIENTE_ID,
        actor_role: "CLIENT",
        procedure_id: PROCEDIMENTO_ID,
        client_id: "outro-cliente",
      }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
    expect(userRepository.findUserById).not.toHaveBeenCalled();
    expect(appointmentRepository.createAppointment).not.toHaveBeenCalled();
  });

  it("deixa o cliente informar o próprio id como client_id", async () => {
    prepararCaminhoFeliz();

    await service.createAppointment({
      start_time: INICIO_VALIDO,
      actor_id: CLIENTE_ID,
      actor_role: "CLIENT",
      procedure_id: PROCEDIMENTO_ID,
      client_id: CLIENTE_ID,
    });

    expect(appointmentRepository.createAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ client_id: CLIENTE_ID }),
    );
  });

  it("cria o agendamento no nome do cliente quando um admin agenda para ele", async () => {
    prepararCaminhoFeliz();
    userRepository.findUserById.mockResolvedValue({ id: CLIENTE_ID, role: "CLIENT" });

    await service.createAppointment({
      start_time: INICIO_VALIDO,
      actor_id: ADMIN_ID,
      actor_role: "ADMIN",
      procedure_id: PROCEDIMENTO_ID,
      client_id: CLIENTE_ID,
    });

    expect(userRepository.findUserById).toHaveBeenCalledWith({ id: CLIENTE_ID });
    expect(appointmentRepository.createAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ client_id: CLIENTE_ID }),
    );
  });

  it("lança NotFoundError quando o admin agenda para um cliente que não existe", async () => {
    prepararCaminhoFeliz();
    userRepository.findUserById.mockResolvedValue(null);

    await expect(
      service.createAppointment({
        start_time: INICIO_VALIDO,
        actor_id: ADMIN_ID,
        actor_role: "ADMIN",
        procedure_id: PROCEDIMENTO_ID,
        client_id: "nao-existe",
      }),
    ).rejects.toThrow("Cliente não encontrado");
    expect(appointmentRepository.createAppointment).not.toHaveBeenCalled();
  });

  it("recusa horário que já passou antes de consultar expediente e bloqueios", async () => {
    prepararCaminhoFeliz();

    await expect(
      service.createAppointment({
        start_time: businessDateTime(DIA_PASSADO, "09:00").toISOString(),
        actor_id: CLIENTE_ID,
        actor_role: "CLIENT",
        procedure_id: PROCEDIMENTO_ID,
      }),
    ).rejects.toThrow("Não é possível agendar em um horário que já passou.");
    expect(workingHoursRepository.findWorkingHoursOfDay).not.toHaveBeenCalled();
    expect(scheduleBlocksRepository.findConflictingScheduleBlock).not.toHaveBeenCalled();
    expect(appointmentRepository.createAppointment).not.toHaveBeenCalled();
  });

  it.each([
    ["o salão não tem expediente cadastrado no dia", null],
    ["o salão está fechado no dia", criarExpediente({ isOpen: false })],
  ])("recusa quando %s", async (_caso, expediente) => {
    prepararCaminhoFeliz();
    workingHoursRepository.findWorkingHoursOfDay.mockResolvedValue(expediente);

    await expect(
      service.createAppointment({
        start_time: INICIO_VALIDO,
        actor_id: CLIENTE_ID,
        actor_role: "CLIENT",
        procedure_id: PROCEDIMENTO_ID,
      }),
    ).rejects.toThrow("O salão não funciona neste dia.");
    expect(appointmentRepository.createAppointment).not.toHaveBeenCalled();
  });

  it.each([
    ["começa antes da abertura", "07:30", "Horário fora do expediente do salão."],
    ["termina depois do fechamento", "17:30", "Horário fora do expediente do salão."],
    ["termina no fechamento (limite)", "17:00", null],
    ["começa fora da grade de 30 min", "09:15", "Horário inválido. Os horários seguem intervalos de 30 minutos a partir da abertura."],
    ["invade o início da pausa", "11:30", "Horário conflita com a pausa do salão."],
    ["começa dentro da pausa", "12:00", "Horário conflita com a pausa do salão."],
    ["começa quando a pausa termina (limite)", "13:00", null],
  ])("horário que %s (%s)", async (_caso, hora, erroEsperado) => {
    prepararCaminhoFeliz();

    const promise = service.createAppointment({
      start_time: businessDateTime(DIA_FUTURO, hora).toISOString(),
      actor_id: CLIENTE_ID,
      actor_role: "CLIENT",
      procedure_id: PROCEDIMENTO_ID,
    });

    if (erroEsperado) {
      await expect(promise).rejects.toThrow(new BadRequestError(erroEsperado));
      expect(appointmentRepository.createAppointment).not.toHaveBeenCalled();
    } else {
      await expect(promise).resolves.toBeDefined();
      expect(appointmentRepository.createAppointment).toHaveBeenCalledTimes(1);
    }
  });

  it("recusa e não cria quando existe bloqueio de agenda no horário", async () => {
    prepararCaminhoFeliz();
    scheduleBlocksRepository.findConflictingScheduleBlock.mockResolvedValue([
      { id: "block-1" },
    ]);

    await expect(
      service.createAppointment({
        start_time: INICIO_VALIDO,
        actor_id: CLIENTE_ID,
        actor_role: "CLIENT",
        procedure_id: PROCEDIMENTO_ID,
      }),
    ).rejects.toThrow("Esta data não está disponível para agendamentos.");
    expect(scheduleBlocksRepository.findConflictingScheduleBlock).toHaveBeenCalledWith({
      start_time: businessDateTime(DIA_FUTURO, "09:00"),
      end_time: businessDateTime(DIA_FUTURO, "10:00"),
    });
    expect(appointmentRepository.createAppointment).not.toHaveBeenCalled();
  });
});

describe("AppointmentService.listMine / listBoard", () => {
  it("lista os agendamentos do cliente informado", async () => {
    const lista = [criarAgendamento()];
    appointmentRepository.findByClientId.mockResolvedValue(lista);

    await expect(service.listMine(CLIENTE_ID)).resolves.toEqual(lista);
    expect(appointmentRepository.findByClientId).toHaveBeenCalledWith(CLIENTE_ID);
  });

  it("converte o período do quadro para o fuso do salão, incluindo o último dia inteiro", async () => {
    appointmentRepository.findBoard.mockResolvedValue([]);

    await service.listBoard("2026-10-12", "2026-10-13");

    expect(appointmentRepository.findBoard).toHaveBeenCalledWith({
      startDate: new Date("2026-10-12T03:00:00.000Z"),
      endDate: new Date("2026-10-14T03:00:00.000Z"),
    });
  });
});

describe("AppointmentService.cancelAppointment", () => {
  it("lança NotFoundError quando o agendamento não existe", async () => {
    appointmentRepository.findById.mockResolvedValue(null);

    await expect(
      service.cancelAppointment({
        appointmentId: "nao-existe",
        actor_id: CLIENTE_ID,
        actor_role: "CLIENT",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(appointmentRepository.cancelAppointment).not.toHaveBeenCalled();
  });

  it("lança BadRequestError quando o agendamento já está cancelado", async () => {
    appointmentRepository.findById.mockResolvedValue(
      criarAgendamento({ status: "CANCELLED" }),
    );

    await expect(
      service.cancelAppointment({
        appointmentId: "appointment-id-1",
        actor_id: CLIENTE_ID,
        actor_role: "CLIENT",
      }),
    ).rejects.toThrow("Este agendamento já está cancelado");
    expect(appointmentRepository.cancelAppointment).not.toHaveBeenCalled();
  });

  it("lança ForbiddenError quando um cliente tenta cancelar o agendamento de outro", async () => {
    appointmentRepository.findById.mockResolvedValue(
      criarAgendamento({ client_id: "outro-cliente" }),
    );

    await expect(
      service.cancelAppointment({
        appointmentId: "appointment-id-1",
        actor_id: CLIENTE_ID,
        actor_role: "CLIENT",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(appointmentRepository.cancelAppointment).not.toHaveBeenCalled();
  });

  it("lança BadRequestError quando o cliente cancela com menos de 24h", async () => {
    appointmentRepository.findById.mockResolvedValue(
      criarAgendamento({ start_time: horasAPartirDeAgora(23) }),
    );

    await expect(
      service.cancelAppointment({
        appointmentId: "appointment-id-1",
        actor_id: CLIENTE_ID,
        actor_role: "CLIENT",
      }),
    ).rejects.toThrow(
      "Cancelamento e edição só são permitidos com no mínimo 24 horas de antecedência.",
    );
    expect(appointmentRepository.cancelAppointment).not.toHaveBeenCalled();
  });

  it("cancela quando o cliente cancela o próprio com mais de 24h", async () => {
    appointmentRepository.findById.mockResolvedValue(
      criarAgendamento({ start_time: horasAPartirDeAgora(25) }),
    );
    appointmentRepository.cancelAppointment.mockResolvedValue(
      criarAgendamento({ status: "CANCELLED" }),
    );

    const resultado = await service.cancelAppointment({
      appointmentId: "appointment-id-1",
      actor_id: CLIENTE_ID,
      actor_role: "CLIENT",
    });

    expect(resultado.status).toBe("CANCELLED");
    expect(appointmentRepository.cancelAppointment).toHaveBeenCalledWith(
      "appointment-id-1",
    );
    expect(appointmentRepository.cancelAppointment).toHaveBeenCalledTimes(1);
  });

  it("deixa o admin cancelar agendamento de qualquer cliente, mesmo com menos de 24h", async () => {
    appointmentRepository.findById.mockResolvedValue(
      criarAgendamento({ client_id: "outro-cliente", start_time: horasAPartirDeAgora(1) }),
    );
    appointmentRepository.cancelAppointment.mockResolvedValue(
      criarAgendamento({ status: "CANCELLED" }),
    );

    await service.cancelAppointment({
      appointmentId: "appointment-id-1",
      actor_id: ADMIN_ID,
      actor_role: "ADMIN",
    });

    expect(appointmentRepository.cancelAppointment).toHaveBeenCalledWith(
      "appointment-id-1",
    );
  });

  it("busca o papel no banco quando ele não vem no token", async () => {
    userRepository.findUserById.mockResolvedValue({ id: ADMIN_ID, role: "ADMIN" });
    appointmentRepository.findById.mockResolvedValue(
      criarAgendamento({ client_id: "outro-cliente" }),
    );
    appointmentRepository.cancelAppointment.mockResolvedValue(
      criarAgendamento({ status: "CANCELLED" }),
    );

    await service.cancelAppointment({
      appointmentId: "appointment-id-1",
      actor_id: ADMIN_ID,
    });

    expect(userRepository.findUserById).toHaveBeenCalledWith({ id: ADMIN_ID });
    expect(appointmentRepository.cancelAppointment).toHaveBeenCalledTimes(1);
  });
});

describe("AppointmentService.updateAppointment", () => {
  // deixa os mocks no "caminho feliz"; cada teste estraga só o que precisa
  function prepararCaminhoFeliz(agendamento = criarAgendamento()) {
    appointmentRepository.findById.mockResolvedValue(agendamento);
    procedureRepository.findProcedureById.mockResolvedValue(criarProcedimento());
    workingHoursRepository.findWorkingHoursOfDay.mockResolvedValue(criarExpediente());
    scheduleBlocksRepository.findConflictingScheduleBlock.mockResolvedValue([]);
    appointmentRepository.updateAppointment.mockResolvedValue(agendamento);
  }

  const NOVO_INICIO = businessDateTime(DIA_FUTURO, "14:00");

  it("lança NotFoundError quando o agendamento não existe", async () => {
    appointmentRepository.findById.mockResolvedValue(null);

    await expect(
      service.updateAppointment({
        appointmentId: "nao-existe",
        actor_id: CLIENTE_ID,
        actor_role: "CLIENT",
        observation: "nova",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(appointmentRepository.updateAppointment).not.toHaveBeenCalled();
  });

  it("lança BadRequestError quando o agendamento está cancelado", async () => {
    prepararCaminhoFeliz(criarAgendamento({ status: "CANCELLED" }));

    await expect(
      service.updateAppointment({
        appointmentId: "appointment-id-1",
        actor_id: CLIENTE_ID,
        actor_role: "CLIENT",
        observation: "nova",
      }),
    ).rejects.toThrow("Não é possível editar um agendamento cancelado");
    expect(appointmentRepository.updateAppointment).not.toHaveBeenCalled();
  });

  it("lança ForbiddenError quando um cliente tenta editar o agendamento de outro", async () => {
    prepararCaminhoFeliz(criarAgendamento({ client_id: "outro-cliente" }));

    await expect(
      service.updateAppointment({
        appointmentId: "appointment-id-1",
        actor_id: CLIENTE_ID,
        actor_role: "CLIENT",
        observation: "nova",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(appointmentRepository.updateAppointment).not.toHaveBeenCalled();
  });

  it("lança BadRequestError quando o cliente edita um agendamento que começa em menos de 24h", async () => {
    prepararCaminhoFeliz(criarAgendamento({ start_time: horasAPartirDeAgora(5) }));

    await expect(
      service.updateAppointment({
        appointmentId: "appointment-id-1",
        actor_id: CLIENTE_ID,
        actor_role: "CLIENT",
        observation: "nova",
      }),
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(appointmentRepository.updateAppointment).not.toHaveBeenCalled();
  });

  it("lança BadRequestError quando o cliente move o agendamento para menos de 24h", async () => {
    prepararCaminhoFeliz();

    await expect(
      service.updateAppointment({
        appointmentId: "appointment-id-1",
        actor_id: CLIENTE_ID,
        actor_role: "CLIENT",
        start_time: horasAPartirDeAgora(2).toISOString(),
      }),
    ).rejects.toThrow(
      "Cancelamento e edição só são permitidos com no mínimo 24 horas de antecedência.",
    );
    expect(appointmentRepository.updateAppointment).not.toHaveBeenCalled();
  });

  it("lança NotFoundError quando o novo procedimento está inativo", async () => {
    prepararCaminhoFeliz();
    procedureRepository.findProcedureById.mockResolvedValue(
      criarProcedimento({ id: "procedure-id-2", is_active: false }),
    );

    await expect(
      service.updateAppointment({
        appointmentId: "appointment-id-1",
        actor_id: CLIENTE_ID,
        actor_role: "CLIENT",
        procedure_id: "procedure-id-2",
      }),
    ).rejects.toThrow("Procedimento não encontrado");
    expect(procedureRepository.findProcedureById).toHaveBeenCalledWith({
      id: "procedure-id-2",
    });
    expect(appointmentRepository.updateAppointment).not.toHaveBeenCalled();
  });

  it("move o agendamento para o novo horário, mantendo procedimento e observação", async () => {
    prepararCaminhoFeliz();

    await service.updateAppointment({
      appointmentId: "appointment-id-1",
      actor_id: CLIENTE_ID,
      actor_role: "CLIENT",
      start_time: NOVO_INICIO.toISOString(),
    });

    expect(appointmentRepository.updateAppointment).toHaveBeenCalledWith({
      id: "appointment-id-1",
      start_time: NOVO_INICIO,
      end_time: businessDateTime(DIA_FUTURO, "15:00"),
      observation: "Observação original",
      procedure_id: PROCEDIMENTO_ID,
    });
    expect(appointmentRepository.updateAppointment).toHaveBeenCalledTimes(1);
  });

  it("recalcula o fim quando troca para um procedimento de outra duração", async () => {
    const agendamento = criarAgendamento({
      start_time: businessDateTime(DIA_FUTURO, "09:00"),
    });
    prepararCaminhoFeliz(agendamento);
    procedureRepository.findProcedureById.mockResolvedValue(
      criarProcedimento({ id: "procedure-id-2", duration_minutes: 90 }),
    );

    await service.updateAppointment({
      appointmentId: "appointment-id-1",
      actor_id: CLIENTE_ID,
      actor_role: "CLIENT",
      procedure_id: "procedure-id-2",
    });

    expect(appointmentRepository.updateAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        start_time: businessDateTime(DIA_FUTURO, "09:00"),
        end_time: businessDateTime(DIA_FUTURO, "10:30"),
        procedure_id: "procedure-id-2",
      }),
    );
  });

  it("não revalida expediente quando só a observação muda", async () => {
    prepararCaminhoFeliz();

    await service.updateAppointment({
      appointmentId: "appointment-id-1",
      actor_id: CLIENTE_ID,
      actor_role: "CLIENT",
      observation: "Nova observação",
    });

    expect(workingHoursRepository.findWorkingHoursOfDay).not.toHaveBeenCalled();
    expect(appointmentRepository.updateAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ observation: "Nova observação" }),
    );
  });

  it("recusa o novo horário quando ele está fora do expediente", async () => {
    prepararCaminhoFeliz();

    await expect(
      service.updateAppointment({
        appointmentId: "appointment-id-1",
        actor_id: CLIENTE_ID,
        actor_role: "CLIENT",
        start_time: businessDateTime(DIA_FUTURO, "19:00").toISOString(),
      }),
    ).rejects.toThrow("Horário fora do expediente do salão.");
    expect(appointmentRepository.updateAppointment).not.toHaveBeenCalled();
  });

  it("recusa o novo horário quando existe bloqueio de agenda", async () => {
    prepararCaminhoFeliz();
    scheduleBlocksRepository.findConflictingScheduleBlock.mockResolvedValue([
      { id: "block-1" },
    ]);

    await expect(
      service.updateAppointment({
        appointmentId: "appointment-id-1",
        actor_id: CLIENTE_ID,
        actor_role: "CLIENT",
        start_time: NOVO_INICIO.toISOString(),
      }),
    ).rejects.toThrow("Esta data não está disponível para agendamentos.");
    expect(appointmentRepository.updateAppointment).not.toHaveBeenCalled();
  });

  it("deixa o admin editar agendamento de outro cliente com menos de 24h", async () => {
    prepararCaminhoFeliz(
      criarAgendamento({ client_id: "outro-cliente", start_time: horasAPartirDeAgora(1) }),
    );

    await service.updateAppointment({
      appointmentId: "appointment-id-1",
      actor_id: ADMIN_ID,
      actor_role: "ADMIN",
      observation: "Ajuste do admin",
    });

    expect(appointmentRepository.updateAppointment).toHaveBeenCalledTimes(1);
  });
});
