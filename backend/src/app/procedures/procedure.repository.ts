import prismaClient from "../../prisma";
import { ConflictError } from "../../errors/app-error";
import {
  CreateProcedureProps,
  DeleteProcedureProps,
  EditProcedureProps,
  FindProcedureByIdProps,
  FindProcedureByNameProps,
  IProcedureRepository,
  Procedure,
} from "./IProcedure.repository";

export class ProcedureRepository implements IProcedureRepository {
  async findProcedureByName({
    name,
  }: FindProcedureByNameProps): Promise<Procedure | null> {
    const procedure = await prismaClient.procedures.findFirst({
      where: {
        name: name,
      },
    });
    return procedure;
  }

  async findProcedureById({
    id,
  }: FindProcedureByIdProps): Promise<Procedure | null> {
    const findProcedure = await prismaClient.procedures.findUnique({
      where: {
        id: id,
      },
    });

    return findProcedure;
  }

  async createProcedure({
    name,
    description,
    price,
    duration_minutes,
  }: CreateProcedureProps): Promise<Procedure> {
    const newProcedure = await prismaClient.procedures.create({
      data: {
        name: name,
        description: description,
        price: price,
        duration_minutes: duration_minutes,
      },
    });

    return newProcedure;
  }

  async deleteProcedure({ id }: DeleteProcedureProps): Promise<Procedure> {
    const deleteProcedure = await prismaClient.procedures.update({
      where: {
        id: id,
      },
      data: {
        is_active: false,
      },
    });
    return deleteProcedure;
  }

  async editProcedure({
    id,
    name,
    description,
    price,
    duration_minutes,
  }: EditProcedureProps): Promise<Procedure> {
    const editProcedure = await prismaClient.$transaction(async (tx) => {
      //Verifica se outro procedimento (id diferente) já usa este nome
      const nameInUse = await tx.procedures.findFirst({
        where: {
          name: name,
          id: { not: id },
        },
      });

      //Se o nome já estiver em uso, a transaction é desfeita e o update não roda
      if (nameInUse) {
        throw new ConflictError(`O procedimento ${name} já existe!`);
      }

      return tx.procedures.update({
        where: {
          id: id,
        },
        data: {
          name: name,
          description: description,
          price: price,
          duration_minutes: duration_minutes,
        },
      });
    });
    return editProcedure;
  }

  async findAllProcedures(): Promise<Procedure[]> {
    const findAllProcedures = await prismaClient.procedures.findMany();
    return findAllProcedures;
  }

  async findActiveProcedures(): Promise<Procedure[]> {
    const findAllProcedures = await prismaClient.procedures.findMany({
      where: {
        is_active: true,
      },
    });
    return findAllProcedures;
  }
}
