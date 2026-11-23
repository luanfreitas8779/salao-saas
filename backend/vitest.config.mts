import { configDefaults, defineConfig } from "vitest/config";

// Testes unitários (npm test): rápidos e sem banco.
// Os testes de integração (*.int.test.ts) ficam de fora: eles precisam do
// banco de teste e rodam com `npm run test:int` (vitest.integration.config.mts).
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "**/*.int.test.ts"],
    // A aplicação lê as variáveis só pelo env validado (validateEnvSchema), que
    // impede o import se faltar alguma. Nos unitários os valores são falsos:
    // nenhum teste unitário conecta no banco nem envia e-mail.
    // O dotenv não sobrescreve variáveis que já existem, então o .env real não interfere.
    env: {
      DATABASE_URL: "postgresql://teste:teste@localhost:5432/unitarios_nao_usam_banco",
      JWT_SECRET: "segredo-so-para-testes",
      EMAIL_USER: "teste@email.com",
      EMAIL_PASS: "senha-falsa",
      FRONTEND_URL: "http://front.teste",
    },
  },
});
