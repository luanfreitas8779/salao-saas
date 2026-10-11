import { NotFoundError, ConflictError } from "../../errors/app-error";
import { Procedures } from "../../generated/prisma/client";
import { ProcedureRepository } from "./procedure.repository";

interface CreateNewProcedureProps {
  name: string;
  description: string;
  price: number;
  duration_minutes: number;
}

interface DeleteProcedureProps {
  id: string;
}

interface EditProceduresProps {
  id: string;
  name: string;
  description: string;
  price: number;
  duration_minutes: number;
}

export class ProcedureService {
  constructor(private readonly repository: ProcedureRepository) {}
  async createProcedure({
    name,
    description,
    price,
    duration_minutes,
  }: CreateNewProcedureProps): Promise<Procedures | undefined> {
    const procedureExist = await this.repository.findProcedureByName({
      name: name,
    });
    //Verifica se há algum procedimento com o mesmo nome
    if (procedureExist) {
      throw new ConflictError(`O procedimento ${name} já existe!`);
    }

    const createProcedure = await this.repository.createProcedure({
      name: name,
      description: description,
      price: price,
      duration_minutes: duration_minutes,
    });
    return createProcedure;
  }

  async deleteProcedure({ id }: DeleteProcedureProps): Promise<Procedures> {
    const procedureExist = await this.repository.findProcedureById({ id });
    if (!procedureExist) {
      throw new NotFoundError(
        "Procedimento não encontrado, atualize a página e tente novamente!",
      );
    }

    const deleteProcedure = await this.repository.deleteProcedure({ id: id });
    return deleteProcedure;
  }

  async editProcedure({
    id,
    name,
    description,
    price,
    duration_minutes,
  }: EditProceduresProps): Promise<Procedures> {
    const procedureExist = await this.repository.findProcedureById({ id: id });
    if (!procedureExist) {
      throw new NotFoundError(
        "Procedimento não encontrado, atualize a página e tente novamente!",
      );
    }

    const editProcedure = await this.repository.editProcedure({
      id: id,
      name: name,
      description: description,
      price: price,
      duration_minutes: duration_minutes,
    });

    return editProcedure;
  }

  async findAllProcedures(): Promise<Procedures[]> {
    const findAllProcedures = await this.repository.findAllProcedures();
    return findAllProcedures;
  }

  async findActiveProcedures(): Promise<Procedures[]> {
    const getAllProcedures = await this.repository.findActiveProcedures();
    return getAllProcedures;
  }
}
