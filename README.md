# whasap.com.br

Monorepo Cloudflare Workers com TanStack Start, ORPC, Neon Postgres e UI shadcn compartilhada.

## Estrutura

```
apps/
  site/      # Marketing whasap.com.br (TanStack Start + Cloudflare)
  web/       # Painel cliente web.whasap.com.br (SPA + ORPC em /rpc)
  office/    # Painel admin interno (SSR + ORPC em /rpc)
  webhook/   # Worker de webhooks (Asaas, Evolution, Meta)
packages/
  ui/          # shadcn compartilhado (@whasap/ui)
  orpc/        # Contratos ORPC (@whasap/orpc — exports /web e /office)
  api-core/    # Utilitários compartilhados (@whasap/api-core)
  api-web/     # Implementação ORPC do painel cliente (@whasap/api-web)
  api-office/  # Implementação ORPC do painel admin (@whasap/api-office)
  db/          # Drizzle + Neon (@whasap/db)
  config/      # Defaults MVP do produto (@whasap/config)
  evolution/   # Schema credenciais Evolution + Secret Store (@whasap/evolution)
  asaas/       # Cliente HTTP Asaas (@whasap/asaas)
```

## Setup

```bash
bun install
cp .env.example .env
cp apps/web/.dev.vars.example apps/web/.dev.vars
cp apps/webhook/.dev.vars.example apps/webhook/.dev.vars
```

Chaves de teste e secrets de exemplo vêm nos arquivos `.example`. Em produção, configure os secrets via `wrangler secret put`.

### Neon + Hyperdrive

1. Crie um projeto em [Neon](https://neon.tech)
2. Configure `DATABASE_URL` no `.env`
3. Crie Hyperdrive (se ainda não existir na conta):
   ```bash
   wrangler hyperdrive create whasap-db --connection-string "$DATABASE_URL"
   ```
4. Os workers `web`, `office` e `webhook` já usam o mesmo binding Hyperdrive em `wrangler.jsonc` (`id: c8f9852b6dc748489154722036fb4e48`)
5. Defina `DATABASE_URL` no `.env` da raiz — o `bun run dev` do web/office repassa para o Hyperdrive local automaticamente
6. **Desenvolvedor:** gere e aplique migrations manualmente:
   ```bash
   bun run db:generate   # após alterar schema em packages/db/src/schema/
   bun run db:migrate
   ```

### Secrets locais

```bash
cp apps/web/.dev.vars.example apps/web/.dev.vars
cp apps/office/.dev.vars.example apps/office/.dev.vars
cp apps/webhook/.dev.vars.example apps/webhook/.dev.vars
```

## Desenvolvimento

```bash
bun run dev
```

| App     | URL                   | Domínio produção        |
|---------|-----------------------|-------------------------|
| site    | http://localhost:3002 | whasap.com.br           |
| web     | http://localhost:3000 | web.whasap.com.br       |
| office  | http://localhost:3001 | office.whasap.com.br    |
| webhook | http://localhost:8788 | webhook.whasap.com.br   |

`web` expõe ORPC em `/rpc` via `@whasap/api-web` (cookie `whasap_web`, 15 dias). `office` expõe ORPC em `/rpc` via `@whasap/api-office` (cookie `whasap_office`, 3 dias). Webhooks Asaas em `webhook.whasap.com.br/asaas`.

### Office — seed inicial

Após `db:migrate`, insira ao menos um usuário em `office_usuario` (login só por OTP, sem signup):

```sql
INSERT INTO office_usuario (email, nome, ativo)
VALUES ('seu-email@exemplo.com', 'Admin', true);
```

## Deploy

```bash
bun run deploy
```

Ordem recomendada (desenvolvedor): `db:migrate` → `cdn` + `webhook` → `site` + `web` + `office`

**Checklist completo de produção:** [docs/PRODUCAO.md](./docs/PRODUCAO.md) (vars, R2, Hyperdrive, Secrets Store, build-time, secrets por app).

## Qualidade de código

```bash
bun run lint        # oxlint
bun run lint:fix    # oxlint --fix
bun run format      # oxfmt --check
bun run format:fix  # oxfmt
```

## Adicionar componentes shadcn

```bash
cd apps/web
bunx --bun shadcn@latest add button --cwd ../../packages/ui
```
