import prismaClient from "../../prisma";
import { addMinutes, parse, format } from "date-fns";

interface AppointmentAvailabilityProps {
  day: string;
  duration_time: number;
}

export class AppointmentAvailabilityService {
  async execute({ day, duration_time }: AppointmentAvailabilityProps) {
    //Define o início e fim do dia para fins de calculos
    const startDay = parse("00:00", "HH:mm", new Date(day));
    const endDay = parse("23:59:59", "HH:mm:ss", new Date(day));
    //Verifica o dia da semana da data enviada
    const dayNow = new Date(day);
    const dayOfWeek = dayNow.getUTCDate();
    // Verifica se o salão está aberto na data selecionada.
    const workingHours = await prismaClient.workingHours.findFirst({
      where: {
        dayOfWeek: dayOfWeek,
      },
      select: {
        start_time: true,
        break_start: true,
        break_end: true,
        end_time: true,
        isOpen: true,
      },
    });
    // Se houver falha para encontrar as informações do dia ou isOpen = false, retorna erro
    if (!workingHours || !workingHours.isOpen) {
      throw new Error(
        "Falha ao buscar horários disponíveis, tente novamente mais tarde!",
      );
    }
    //Salva os horarios de abertura e fechamento no dia enviado para melhor calculo dos bloqueios na agenda
    const openHour = parse(workingHours.start_time, "HH:mm", new Date(day));
    const closeHour = parse(workingHours.end_time, "HH:mm", new Date(day));

    //Busca no banco de dados em uma unica promise todos os bloqueios e os agendamentos do dia.
    const [getBlocksOnDay, appointmentsOnDay] = await Promise.all([
      prismaClient.schedule_blocks.findMany({
        where: {
          start_time: { lt: endDay },
          end_time: { gt: startDay },
        },
        select: {
          start_time: true,
          end_time: true,
        },
        orderBy: {
          start_time: "asc",
        },
      }),
      prismaClient.appointments.findMany({
        where: {
          start_time: { lt: endDay },
          end_time: { gt: startDay },
        },
        select: {
          start_time: true,
          end_time: true,
        },
      }),
    ]);

    //Após coletar todos os bloqueios possíveis, inicia a lógica de horários livres:
    //1. Coloca todos os bloqueios dentro de um array
    //2. Coloca array em forma cronológica pelo start_time
    //3. Inicia variável dos possiveis horários como array [] a ser preenchido pelo loop while.
    //4. Utiliza o método SOME para comparar os horários (início e fim do procedimento), se algum chocar, retorna true, se não será return false
    //5. Adiciona o horário disponível dentro do array de possíveis horários, faz isso desde a hora de abertura coletada até de fechamento.
    //coloca todos os bloqueios de horários dentro de uma variável única
    let blocksOnDay = [...appointmentsOnDay, ...getBlocksOnDay];

    //Converte horário de parada e retorno em horas e passa em um objeto no padrão start e end time para inserir na lista de bloqueios.
    if (workingHours.break_start && workingHours.break_end) {
      let startBreak = parse(workingHours.break_start, "HH:mm", new Date(day));
      let endBreak = parse(workingHours.break_end, "HH:mm", new Date(day));
      let breakHour = {
        start_time: startBreak,
        end_time: endBreak,
      };
      blocksOnDay.push(breakHour);
    }
    blocksOnDay.sort((a, b) => +a.start_time - +b.start_time); // COLOCA O ARRAY EM ORDEM CRONOLÓGICA PELO START_TIME

    let possibleHours = [];
    let startHourCompare = openHour;
    let finishHourCompare = addMinutes(startHourCompare, duration_time);

    while (startHourCompare < closeHour) {
      let isAvailable = blocksOnDay.some((block) => {
        return (
          startHourCompare < block.end_time &&
          finishHourCompare > block.start_time
        );
      });

      if (!isAvailable) {
        possibleHours.push(format(startHourCompare, "HH:mm"));
      }

      startHourCompare = addMinutes(startHourCompare, 30);
      finishHourCompare = addMinutes(finishHourCompare, 30);
    }

    return possibleHours;
  }
}
