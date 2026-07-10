import { defineConfig } from "vitest/config";

/** Testes unitários do painel (e2e Playwright fica em `vitest.e2e.config.ts`). */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
