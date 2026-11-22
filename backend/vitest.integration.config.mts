import { existsSync, readFileSync } from "fs";
import { parse } from "dotenv";
import { defineConfig } from "vitest/config";

// Testes de integração (npm run test:int): rodam contra um Postgres de verdade,
// no banco de teste definido no .env.test (nunca o banco de desenvolvimento).

if (!existsSync(".env.test")) {
  throw new Error(
    "Arquivo .env.test não encontrado. Copie o .env.test.example e ajuste o DATABASE_URL.",
  );
}

const testEnv = {
  // valores falsos, só para os testes de API (rotas com login e e-mail de recuperação)
  JWT_SECRET: "segredo-so-para-testes",
  FRONTEND_URL: "http://front.teste",
  ...parse(readFileSync(".env.test")),
};

// O globalSetup roda neste processo (o principal), não nos processos dos testes:
// ele também precisa enxergar o banco de teste.
Object.assign(process.env, testEnv);

export default defineConfig({
  test: {
    include: ["src/**/*.int.test.ts"],
    // O DATABASE_URL do .env.test entra no process.env ANTES de qualquer import.
    // O src/prisma/index.ts carrega o .env com dotenv, mas o dotenv não
    // sobrescreve variáveis que já existem: por isso o banco de teste prevalece.
    env: testEnv,
    // Roda uma vez antes de tudo: confere o banco e aplica as migrations nele.
    globalSetup: ["./test-integration/global-setup.ts"],
    // Todos os arquivos usam o MESMO banco e limpam as tabelas entre os testes.
    // Se dois arquivos rodassem ao mesmo tempo, um apagaria os dados do outro.
    fileParallelism: false,
    // O padrão do Vitest é 5s por teste. Com banco de verdade é pouco: cada
    // deadlock do teste de concorrência leva ~1s até o Postgres resolver
    // (o deadlock_timeout padrão dele). Se um teste estoura o tempo, o código
    // dele continua rodando em segundo plano e atrapalha o teste seguinte.
    testTimeout: 30_000,
  },
});
