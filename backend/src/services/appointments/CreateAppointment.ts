import prismaClient from "../../prisma";
import { addMinutes } from "date-fns";

interface CreateAppointmentProps {
  start_time: string;
  observation: string;
  client_id: string;
  procedure_id: string;
}

export class CreateAppointmentService {
  async execute({
    start_time,
    observation,
    client_id,
    procedure_id,
  }: CreateAppointmentProps) {
    //Verifica a duração do procedimento escolhido
    const procedure = await prismaClient.procedures.findUnique({
      where: {
        id: procedure_id,
      },
      select: {
        duration_minutes: true,
      },
    });

    //valida se há uma duração válida
    if (
      !procedure ||
      typeof procedure.duration_minutes !== "number" ||
      procedure.duration_minutes <= 0
    ) {
      throw new Error("Procedimento não encontrado ou duração inválida!");
    }

    //Calculo do horário de termino do procedimento
    const startHour = new Date(start_time);
    const end_time = addMinutes(startHour, procedure.duration_minutes);

    //Verifica se há conflito entre os horários já agendados com o novo a ser criado
    const hasConflict = await prismaClient.appointments.findFirst({
      where: {
        status: { not: "CANCELLED" },
        start_time: { lt: end_time },
        end_time: { gt: startHour },
      },
    });

    //Se houver conflito interrompe o fluxo e retorna um Erro:
    if (hasConflict) {
      throw new Error(
        "Erro: Já existe um agendamento neste horário, atualize a página e tente novamente!",
      );
    }

    //Verificar se há bloqueio na agenda para a data
    const hasBlock = await prismaClient.schedule_blocks.findFirst({
      where: {
        start_time: { lt: end_time },
        end_time: { gt: startHour },
      },
    });
    if (hasBlock) {
      throw new Error("Esta data não está disponível para agendamentos.");
    }

    //Se estiver tudo certo, faz o agendamento.
    const newAppointment = await prismaClient.appointments.create({
      data: {
        start_time: startHour,
        end_time: end_time,
        observation: observation,
        client_id: client_id,
        procedure_id: procedure_id,
      },
    });

    return newAppointment;
  }
}
