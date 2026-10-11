import { hash } from "bcrypt";
import prismaClient from "../src/prisma/index";

async function main() {
  // Horários de funcionamento padrão
  await prismaClient.workingHours.createMany({
    data: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
      dayOfWeek: day,
      start_time: "08:00",
      end_time: "18:00",
      break_start: "12:00",
      break_end: "14:00",
      isOpen: day !== 0, // domingo fechado por padrão
    })),
    skipDuplicates: true, // não quebra se já existir
  });

  // Senha do admin precisa ser guardada como hash bcrypt, igual ao cadastro de usuários
  const adminPasswordHash = await hash("admin1q2w3e", 10);

  await prismaClient.users.upsert({
    where: { email: "adminsalao@gmail.com" },
    update: {},
    create: {
      name: "Administrador",
      email: "adminsalao@gmail.com",
      phone: "99999999999",
      password_hash: adminPasswordHash,
      role: "ADMIN",
    },
  });

  console.log("Seed concluído!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prismaClient.$disconnect();
  });
