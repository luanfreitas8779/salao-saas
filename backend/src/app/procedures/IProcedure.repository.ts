//Tipo próprio do domínio, sem depender do Prisma.
//Se o banco mudar, o service continua usando este mesmo formato.
export interface Procedure {
  id: string;
  name: string;
  description: string;
  price: number;
  duration_minutes: number;
  is_active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FindProcedureByNameProps {
  name: string;
}

export interface FindProcedureByIdProps {
  id: string;
}

export interface CreateProcedureProps {
  name: string;
  description: string;
  price: number;
  duration_minutes: number;
}

export interface EditProcedureProps {
  id: string;
  name: string;
  description: string;
  price: number;
  duration_minutes: number;
}

export interface DeleteProcedureProps {
  id: string;
}

//Contrato que qualquer repository de procedimentos precisa cumprir
export interface IProcedureRepository {
  findProcedureByName({
    name,
  }: FindProcedureByNameProps): Promise<Procedure | null>;
  findProcedureById({ id }: FindProcedureByIdProps): Promise<Procedure | null>;
  createProcedure({
    name,
    description,
    price,
    duration_minutes,
  }: CreateProcedureProps): Promise<Procedure>;
  deleteProcedure({ id }: DeleteProcedureProps): Promise<Procedure>;
  //Lança ConflictError se outro procedimento já usar o mesmo nome
  editProcedure({
    id,
    name,
    description,
    price,
    duration_minutes,
  }: EditProcedureProps): Promise<Procedure>;
  findAllProcedures(): Promise<Procedure[]>;
  findActiveProcedures(): Promise<Procedure[]>;
}
