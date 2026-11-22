import prismaClient from "../src/prisma/index";
import { assertTestDatabase } from "./database-guard";

// Ferramentas compartilhadas pelos testes de integração.

// Apaga os dados de todas as tabelas (a estrutura e a constraint continuam).
// Usado no beforeEach: cada teste começa com o banco vazio e não enxerga
// os dados que o teste anterior criou.
export async function limparBanco() {
  assertTestDatabase(process.env.DATABASE_URL);

  await prismaClient.$executeRawUnsafe(`
    TRUNCATE TABLE
      "appointments",
      "schedule_blocks",
      "passwordResetToken",
      "procedures",
      "users",
      "workingHours"
    CASCADE
  `);
}

// email e telefone são únicos no banco: o contador evita repetição entre chamadas
let contador = 0;

export async function criarUsuario(sobrescrever: { role?: "CLIENT" | "ADMIN" } = {}) {
  contador++;
  return prismaClient.users.create({
    data: {
      name: `Usuário ${contador}`,
      email: `usuario${contador}@teste.local`,
      phone: `119${String(contador).padStart(8, "0")}`,
      password_hash: "hash-qualquer",
      ...sobrescrever,
    },
  });
}

export async function criarProcedimento(
  sobrescrever: { name?: string; duration_minutes?: number; is_active?: boolean } = {},
) {
  contador++;
  return prismaClient.procedures.create({
    data: {
      name: `Procedimento ${contador}`,
      description: "Descrição",
      price: 8000,
      duration_minutes: 60,
      ...sobrescrever,
    },
  });
}

export { prismaClient };
