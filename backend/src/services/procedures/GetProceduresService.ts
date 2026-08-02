import prismaClient from "../../prisma/index";

export class GetProceduresService {
  async execute() {
    const procedures = await prismaClient.procedures.findMany({
      where: {
        is_active: true,
      },
    });

    return procedures;
  }
}
