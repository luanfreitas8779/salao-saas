import { NotFoundError, ConflictError } from "../../errors/app-error";
import { IProcedureRepository, Procedure } from "./IProcedure.repository";

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
  //Recebe a interface, não o repository real. Quem decide qual usar é a factory.
  constructor(private readonly repository: IProcedureRepository) {}
  async createProcedure({
    name,
    description,
    price,
    duration_minutes,
  }: CreateNewProcedureProps): Promise<Procedure> {
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

  async deleteProcedure({ id }: DeleteProcedureProps): Promise<Procedure> {
    await this.ensureProcedureExists({ id: id });

    const deleteProcedure = await this.repository.deleteProcedure({ id: id });
    return deleteProcedure;
  }

  async editProcedure({
    id,
    name,
    description,
    price,
    duration_minutes,
  }: EditProceduresProps): Promise<Procedure> {
    await this.ensureProcedureExists({ id: id });

    const editProcedure = await this.repository.editProcedure({
      id: id,
      name: name,
      description: description,
      price: price,
      duration_minutes: duration_minutes,
    });

    return editProcedure;
  }

  async findAllProcedures(): Promise<Procedure[]> {
    const findAllProcedures = await this.repository.findAllProcedures();
    return findAllProcedures;
  }

  async findActiveProcedures(): Promise<Procedure[]> {
    const getAllProcedures = await this.repository.findActiveProcedures();
    return getAllProcedures;
  }

  //Validação repetida em delete e edit, centralizada em um lugar só
  private async ensureProcedureExists({
    id,
  }: DeleteProcedureProps): Promise<Procedure> {
    const procedureExist = await this.repository.findProcedureById({ id: id });
    if (!procedureExist) {
      throw new NotFoundError(
        "Procedimento não encontrado, atualize a página e tente novamente!",
      );
    }
    return procedureExist;
  }
}
