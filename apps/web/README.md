# apps/web — Painel cliente

SPA TanStack Start + Cloudflare Worker (`/rpc` in-process com `@whasap/api-web`).

Rotas: [ROUTES.md](./ROUTES.md)

## Testes E2E (Playwright + Vitest)

Wizard de entrada (`/~/`) em browser real via **Playwright** (ambiente Node do Vitest). OTP lido do Postgres com helpers de `@whasap/api-web/test`.

O runner [`e2e/run.ts`](./e2e/run.ts) sobe o dev server na porta **3099** e executa os testes. Vitest Browser não é usado — o iframe do runner não suporta app TanStack Start + Cloudflare em outra origem.

**Pré-requisitos:**

- `DATABASE_URL` na raiz (`.env`) e migrations aplicadas
- `apps/web/.dev.vars` com `WEB_SESSION_JWT_SECRET` (string)
- Chromium do Playwright: `bunx playwright install chromium`

```bash
cd apps/web && bun run test:browser
# Browser visível:
E2E_HEADED=1 bun run test:browser:ui
```

Casos em [`e2e/entrada.e2e.test.ts`](./e2e/entrada.e2e.test.ts).

Integração RPC (mais rápida, sem browser): `cd packages/api-web && bun run test`.

Na raiz: `bun run test` executa ambas as suítes.
