import prismaClient from "../../prisma/index";

interface UserProfileServiceProps {
  id: string;
}
export class UserProfileService {
  async execute({ id }: UserProfileServiceProps) {
    const user = await prismaClient.users.findUnique({
      where: {
        id: id,
      },
      select: {
        name: true,
        email: true,
        phone: true,
      },
    });
    if (!user) {
      throw new Error(
        "Falha ao buscar dados do usuário, tente novamente mais tarde!",
      );
    }

    return user;
  }
}
