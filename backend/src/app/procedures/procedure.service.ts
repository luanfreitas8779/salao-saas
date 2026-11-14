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
    const procedureWithSameName = await this.repository.findProcedureByName({
      name: name,
    });
    //Verifica se há algum procedimento com o mesmo nome
    if (procedureWithSameName) {
      throw new ConflictError(`O procedimento ${name} já existe!`);
    }

    const createdProcedure = await this.repository.createProcedure({
      name: name,
      description: description,
      price: price,
      duration_minutes: duration_minutes,
    });
    return createdProcedure;
  }

  async deleteProcedure({ id }: DeleteProcedureProps): Promise<Procedure> {
    await this.ensureProcedureExists({ id: id });

    const deactivatedProcedure = await this.repository.deleteProcedure({ id: id });
    return deactivatedProcedure;
  }

  async editProcedure({
    id,
    name,
    description,
    price,
    duration_minutes,
  }: EditProceduresProps): Promise<Procedure> {
    await this.ensureProcedureExists({ id: id });

    const updatedProcedure = await this.repository.editProcedure({
      id: id,
      name: name,
      description: description,
      price: price,
      duration_minutes: duration_minutes,
    });

    return updatedProcedure;
  }

  async findAllProcedures(): Promise<Procedure[]> {
    const procedures = await this.repository.findAllProcedures();
    return procedures;
  }

  async findActiveProcedures(): Promise<Procedure[]> {
    const activeProcedures = await this.repository.findActiveProcedures();
    return activeProcedures;
  }

  //Validação repetida em delete e edit, centralizada em um lugar só
  private async ensureProcedureExists({
    id,
  }: DeleteProcedureProps): Promise<Procedure> {
    const procedure = await this.repository.findProcedureById({ id: id });
    if (!procedure) {
      throw new NotFoundError(
        "Procedimento não encontrado, atualize a página e tente novamente!",
      );
    }
    return procedure;
  }
}
