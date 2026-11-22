import { execSync } from "child_process";
import { assertTestDatabase } from "./database-guard";

// Roda UMA vez, antes de todos os testes de integração (não a cada arquivo).
export function setup() {
  const databaseUrl = process.env.DATABASE_URL;
  assertTestDatabase(databaseUrl);

  // Aplica as migrations no banco de teste. É assim que a constraint
  // appointments_no_overlap passa a existir nele. O `migrate deploy` só aplica
  // o que falta e nunca apaga o banco.
  execSync("npx prisma migrate deploy", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}
