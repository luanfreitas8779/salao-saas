import prismaClient from "../../prisma/index";

interface EditProceduresProps {
  id: string;
  name: string;
  description: string;
  price: number;
  duration_minutes: number;
}

export class EditProcedureService {
  async execute({
    id,
    name,
    description,
    price,
    duration_minutes,
  }: EditProceduresProps) {
    const procedureExist = await prismaClient.procedures.findUnique({
      where: {
        id: id,
      },
    });
    if (!procedureExist) {
      throw new Error(
        "Procedimento não encontrado, atualize a página e tente novamente!",
      );
    }

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
}
