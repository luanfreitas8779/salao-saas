import prismaClient from "../../prisma/index";

interface DeleteProcedureProps {
  id: string;
}

export class DeleteProcedureService {
  async execute({ id }: DeleteProcedureProps) {
    try {
      const deleteProcedure = await prismaClient.procedures.update({
        where: {
          id: id,
        },
        data: {
          is_active: false,
        },
      });
      return deleteProcedure;
    } catch {
      throw new Error("Falha ao deletar procedimento");
    }
  }
}
