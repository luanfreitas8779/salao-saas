import prismaClient from "../../prisma";
import { Appointments } from "../../generated/prisma/client";
import { ConflictError } from "../../errors/app-error";

interface GetAppointmentsOnDayProps {
  startDay: Date;
  endDay: Date;
}

interface FindConflictingAppointmentProps {
  start_time: Date;
  end_time: Date;
  excludeId?: string;
}

interface AppointmentPeriod {
  start_time: Date;
  end_time: Date;
}

interface CreateAppointmentProps {
  start_time: Date;
  end_time: Date;
  observation?: string;
  client_id: string;
  procedure_id: string;
}

interface PaginationProps {
  skip: number;
  take: number;
}

interface BoardRangeProps {
  startDate: Date;
  endDate: Date;
}

interface UpdateAppointmentProps {
  id: string;
  start_time: Date;
  end_time: Date;
  observation?: string;
  procedure_id: string;
}

const appointmentRelations = {
  procedure: {
    select: {
      id: true,
      name: true,
      duration_minutes: true,
      price: true,
    },
  },
  client: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
    },
  },
} as const;

const OVERLAP_MESSAGE =
  "Erro: Já existe um agendamento neste horário, atualize a página e tente novamente!";

//Quem impede dois agendamentos no mesmo horário é o banco, com a constraint
//appointments_no_overlap (ver a migration 20261010195200). Ela é conferida
//dentro do próprio INSERT/UPDATE, de forma atômica: de duas requisições
//simultâneas, uma grava e a outra é recusada.
//
//A recusa pode chegar de dois jeitos:
//  - 23P01 (exclusion_violation): o caso comum, vira ConflictError (409).
//  - 40P01 (deadlock): quando as duas gravações chegam juntas, cada uma espera
//    a outra terminar para saber se há conflito, e o Postgres cancela uma delas.
//    A cancelada é repetida (withDeadlockRetry). Na nova tentativa a outra já
//    terminou, e o resultado volta a ser o normal: grava, ou recebe 23P01.
//
//Onde o código do Postgres chega depende da versão do @prisma/adapter-pg
//(formatos capturados do Postgres de verdade):
//  - 7.8:  Error com o código em error.cause.code
//  - 7.10: PrismaClientKnownRequestError com os dados do driver em
//          error.meta.driverAdapterError.cause. Na sobreposição (P2039) vem o
//          code; no deadlock (P2034, TransactionWriteConflict) só o originalCode.
//Todos são aceitos. O teste de integração (npm run test:int) é quem avisa se
//uma atualização do Prisma mudar o formato de novo.
//Não usamos a mensagem: ela muda com o idioma configurado no Postgres.
const OVERLAP_ERROR_CODE = "23P01";
const DEADLOCK_ERROR_CODE = "40P01";
const MAX_ATTEMPTS = 3;

interface DriverErrorCause {
  code?: unknown;
  originalCode?: unknown;
}

interface PostgresErrorShape {
  cause?: DriverErrorCause;
  meta?: { driverAdapterError?: { cause?: DriverErrorCause } };
}

function postgresErrorCode(error: unknown): unknown {
  if (!(error instanceof Error)) {
    return undefined;
  }
  const { cause, meta } = error as Error & PostgresErrorShape;
  const driverCause = cause ?? meta?.driverAdapterError?.cause;
  return driverCause?.code ?? driverCause?.originalCode;
}

function isOverlapConstraintError(error: unknown): boolean {
  return postgresErrorCode(error) === OVERLAP_ERROR_CODE;
}

async function withDeadlockRetry<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const isDeadlock = postgresErrorCode(error) === DEADLOCK_ERROR_CODE;
      if (isDeadlock && attempt < MAX_ATTEMPTS) {
        continue;
      }
      throw error;
    }
  }
}

export class AppointmentRepository {
  async getAppointmentsOnDay({
    startDay,
    endDay,
  }: GetAppointmentsOnDayProps): Promise<AppointmentPeriod[]> {
    const appointments = await prismaClient.appointments.findMany({
      where: {
        status: { not: "CANCELLED" },
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
    });
    return appointments;
  }

  async findConflictingAppointment({
    start_time,
    end_time,
    excludeId,
  }: FindConflictingAppointmentProps): Promise<Appointments | null> {
    return await prismaClient.appointments.findFirst({
      where: {
        status: { not: "CANCELLED" },
        start_time: { lt: end_time },
        end_time: { gt: start_time },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  async createAppointment({
    start_time,
    end_time,
    observation,
    client_id,
    procedure_id,
  }: CreateAppointmentProps): Promise<Appointments> {
    try {
      return await withDeadlockRetry(() =>
        prismaClient.appointments.create({
          data: {
            start_time,
            end_time,
            observation,
            client_id,
            procedure_id,
          },
          include: appointmentRelations,
        }),
      );
    } catch (error) {
      if (isOverlapConstraintError(error)) {
        throw new ConflictError(OVERLAP_MESSAGE);
      }
      throw error;
    }
  }

  async findById(id: string) {
    return prismaClient.appointments.findUnique({
      where: { id },
      include: appointmentRelations,
    });
  }

  //Uma página dos agendamentos do cliente e o total (para o front montar a paginação).
  //A lista e a contagem vão na mesma transação, para o total bater com a lista.
  async findByClientId(client_id: string, { skip, take }: PaginationProps) {
    const [items, total] = await prismaClient.$transaction([
      prismaClient.appointments.findMany({
        where: { client_id },
        include: {
          procedure: {
            select: {
              id: true,
              name: true,
              duration_minutes: true,
              price: true,
            },
          },
        },
        orderBy: { start_time: "desc" },
        skip,
        take,
      }),
      prismaClient.appointments.count({ where: { client_id } }),
    ]);

    return { items, total };
  }

  async findBoard({ startDate, endDate }: BoardRangeProps) {
    return prismaClient.appointments.findMany({
      where: {
        start_time: { lt: endDate },
        end_time: { gt: startDate },
      },
      include: appointmentRelations,
      orderBy: { start_time: "asc" },
    });
  }

  async cancelAppointment(id: string): Promise<Appointments> {
    return prismaClient.appointments.update({
      where: { id },
      data: { status: "CANCELLED" },
      include: appointmentRelations,
    });
  }

  async completeAppointment(id: string): Promise<Appointments> {
    return prismaClient.appointments.update({
      where: { id },
      data: { status: "COMPLETED" },
      include: appointmentRelations,
    });
  }

  async updateAppointment({
    id,
    start_time,
    end_time,
    observation,
    procedure_id,
  }: UpdateAppointmentProps) {
    try {
      return await withDeadlockRetry(() =>
        prismaClient.appointments.update({
          where: { id },
          data: {
            start_time,
            end_time,
            observation,
            procedure_id,
            status: "SCHEDULED",
          },
          include: appointmentRelations,
        }),
      );
    } catch (error) {
      if (isOverlapConstraintError(error)) {
        throw new ConflictError(OVERLAP_MESSAGE);
      }
      throw error;
    }
  }
}
