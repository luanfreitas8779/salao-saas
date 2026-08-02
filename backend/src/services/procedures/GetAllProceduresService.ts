import prismaClient from "../../prisma/index";

export class GetAllProceduresService {
  async execute() {
    try {
      const allProcedures = await prismaClient.procedures.findMany();
      return allProcedures;
    } catch (err) {
      throw new Error(
        "Erro ao buscar procedimentos, tente novamente mais tarde",
      );
    }
  }
}
