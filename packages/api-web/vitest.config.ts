import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
    include: [
      "src/integration/**/*.test.ts",
      "src/lib/instancia-historico-sync-mapper.test.ts",
      "src/handlers/org-criar.test.ts",
    ],
    testTimeout: 30_000,
    pool: "forks",
  },
});
