import { defineConfig } from "vitest/config";

/**
 * E2E do wizard `/~/` via Playwright em ambiente Node (Vitest Browser não suporta
 * navegação cross-origin para app TanStack Start + Cloudflare no iframe).
 */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    include: ["e2e/**/*.e2e.test.ts"],
    environment: "node",
    testTimeout: 60_000,
    server: {
      deps: {
        inline: [/@whasap\/.*/],
      },
    },
  },
});
