import { Procedures } from "../../generated/prisma/client";
import prismaClient from "../../prisma";

interface FindProcedureByNameProps {
  name: string;
}

interface FindProcedureById {
  id: string;
}

interface CreateProcedureProps {
  name: string;
  description: string;
  price: number;
  duration_minutes: number;
}

interface EditProceduresProps {
  id: string;
  name: string;
  description: string;
  price: number;
  duration_minutes: number;
}

interface DeleteProcedureProps {
  id: string;
}

export class ProcedureRepository {
  async findProcedureByName({
    name,
  }: FindProcedureByNameProps): Promise<Procedures | null> {
    const procedure = await prismaClient.procedures.findFirst({
      where: {
        name: name,
      },
    });
    return procedure;
  }

  async findProcedureById({
    id,
  }: FindProcedureById): Promise<Procedures | null> {
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
  }: CreateProcedureProps): Promise<Procedures | undefined> {
    const newProcedure = prismaClient.procedures.create({
      data: {
        name: name,
        description: description,
        price: price,
        duration_minutes: duration_minutes,
      },
    });

    return newProcedure;
  }

  async deleteProcedure({ id }: DeleteProcedureProps): Promise<Procedures> {
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
  }: EditProceduresProps): Promise<Procedures> {
    const editProcedure = await prismaClient.procedures.update({
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
    return editProcedure;
  }

  async findAllProcedures(): Promise<Procedures[]> {
    const findAllProcedures = await prismaClient.procedures.findMany();
    return findAllProcedures;
  }

  async findActiveProcedures(): Promise<Procedures[]> {
    const findAllProcedures = await prismaClient.procedures.findMany({
      where: {
        is_active: true,
      },
    });
    return findAllProcedures;
  }
}
