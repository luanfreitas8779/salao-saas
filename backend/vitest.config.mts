import { configDefaults, defineConfig } from "vitest/config";

// Testes unitários (npm test): rápidos e sem banco.
// Os testes de integração (*.int.test.ts) ficam de fora: eles precisam do
// banco de teste e rodam com `npm run test:int` (vitest.integration.config.mts).
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "**/*.int.test.ts"],
  },
});
