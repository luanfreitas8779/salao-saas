import prismaClient from "../../prisma/index";
import bcrypt from "bcrypt";

interface CreateUserProps {
  name: string;
  email: string;
  phone: string;
  password: string;
}

class CreateUserService {
  async execute({ name, email, phone, password }: CreateUserProps) {
    const [emailExists, phoneExists] = await Promise.all([
      prismaClient.users.findUnique({ where: { email } }),
      prismaClient.users.findUnique({ where: { phone } }),
    ]);

    if (emailExists) {
      throw new Error("Já existe um usuário com este email!");
    }

    if (phoneExists) {
      throw new Error("Já existe um usuário com este número de telefone!");
    }

    const password_hash = await bcrypt.hash(password, 10);

    const user = await prismaClient.users.create({
      data: {
        name: name,
        email: email,
        phone: phone,
        password_hash: password_hash,
      },
    });

    return user.name;
  }
}

export { CreateUserService };
