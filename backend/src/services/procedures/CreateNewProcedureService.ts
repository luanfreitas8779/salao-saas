import prismaClient from "../../prisma/index";

interface CreateNewProcedureProps {
  name: string;
  description: string;
  price: number;
  duration_time: number;
}
export class CreateNewProcedureService {
  async execute({
    name,
    description,
    price,
    duration_time,
  }: CreateNewProcedureProps) {
    const procedureExist = await prismaClient.procedures.findFirst({
      where: {
        name: name,
      },
    });
    //Verifica se há algum procedimento com o mesmo nome
    if (procedureExist) {
      throw new Error(`O procedimento ${name} já existe!`);
    }

    const createProcedure = await prismaClient.procedures.create({
      data: {
        name: name,
        description: description,
        price: price,
        duration_minutes: duration_time,
      },
    });

    return createProcedure;
  }
}
