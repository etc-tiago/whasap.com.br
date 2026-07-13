# Variáveis de ambiente — Whasap

Guia de **vars no código** vs **secrets** isolados. Infra: [PRODUCAO.md](./PRODUCAO.md) · Secrets webhook: [SECRETS-WEBHOOK.md](./SECRETS-WEBHOOK.md)

## Fonte canônica

URLs de produção e dev centralizadas em [`packages/config/src/public-urls.ts`](../packages/config/src/public-urls.ts):

- `workerVarsProduction` → `vars` nos `wrangler.jsonc` (deploy)
- `workerVarsDevelopment` → copiar para `.dev.vars` (local)
- `viteVarsProduction` → `.env.production` dos apps Vite

Validar sync:

```bash
bun run validate:env
```

## Dois mecanismos

| Mecanismo | Quando | Onde |
|-----------|--------|------|
| **Worker `vars`** | Runtime no servidor (checkouts, convites, CDN) | `wrangler.jsonc` = **produção** |
| **`VITE_*`** | Embutido no bundle no `vite build` | `.env.production` (prod) / `.env` (dev) |
| **Secrets** | API keys, tokens webhook | Secrets Store / `wrangler secret put` / `.dev.vars` |

## Por que `vars` = produção no top-level

`wrangler deploy` publica o bloco `vars` do top-level. Valores de localhost no jsonc iam para produção.

**Local:** `.dev.vars` (gitignored) sobrescreve `vars` só em desenvolvimento.

Não usamos `wrangler deploy --env production` — isso criaria workers com sufixo `-production` e quebraria domínios customizados.

## Classificação por variável

| Variável | Tipo | Produção | Local |
|----------|------|----------|-------|
| `WEB_URL`, `OFFICE_URL`, `WEBHOOK_URL`, `CDN_URL` | var | `wrangler.jsonc` | `.dev.vars` |
| `EMAIL_FROM` | var | `wrangler.jsonc` | `.dev.vars` |
| `VITE_WEB_PANEL_URL` | build | `apps/site/.env.production` | `.env` / `.env.example` |
| `VITE_META_APP_ID`, `VITE_META_CONFIG_ID` | build | `apps/web/.env.production` | `.env` |
| `ASAAS_SANDBOX` | flag dev | não definir | `.dev.vars` = `true` |
| `ASSAS_API_KEY` | secret | Secrets Store | `.dev.vars` |
| `EVOLUTION_SECRETS_STORE` | secret | Secrets Store (JSON `{ baseUrl, apiKey }`) | `.dev.vars` |
| `WEB_SESSION_JWT_SECRET` | secret | `wrangler secret put` | `.dev.vars` |
| `OFFICE_SESSION_JWT_SECRET` | secret | `wrangler secret put` | `.dev.vars` |
| `WHATSAPP_CLOUD_WEBHOOK_SECRET` | secret | `wrangler secret put` | `.dev.vars` |
| `ASAAS_WEBHOOK_TOKEN` | secret | `wrangler secret put` | `.dev.vars` |

## Por app

### `apps/site`

- Worker vars: nenhuma
- Build: `apps/site/.env.production` → `VITE_WEB_PANEL_URL`
- Dev: `VITE_WEB_PANEL_URL` na raiz `.env` ou `apps/site/.env.example`

### `apps/web`

- Worker vars: `WEB_URL`, `OFFICE_URL`, `WEBHOOK_URL`, `CDN_URL`, `EMAIL_FROM`
- Secrets Store: `ASSAS_API_KEY`, `EVOLUTION_SECRETS_STORE`
- Build: `apps/web/.env.production` → `VITE_META_*`
- Dev: `apps/web/.dev.vars` + `.env` raiz

### `apps/office`

- Worker vars: `WEB_URL`, `OFFICE_URL`, `EMAIL_FROM`
- Dev: `apps/office/.dev.vars`

### `apps/webhook`

- Worker vars: `CDN_URL`
- Secrets Store: `ASSAS_API_KEY`, `EVOLUTION_SECRETS_STORE`
- Secrets: ver [SECRETS-WEBHOOK.md](./SECRETS-WEBHOOK.md)
- Dev: `apps/webhook/.dev.vars`

### `apps/evolution-cleanup`

- Worker vars: `WORKER_NAME`
- Secrets Store: `EVOLUTION_SECRETS_STORE`
- Sem domínio (só Cron Trigger `*/15`) — remoção de instâncias Evolution abandonadas
- Dev: `apps/evolution-cleanup/.dev.vars`

### `apps/history-sync`

- Worker vars: `WORKER_NAME`
- Sem domínio — consumer da fila `whasap-history-sync` (chunks HistorySync enfileirados pelo `webhook`)
- Cada mensagem da fila cria uma instância do Workflow `whasap-history-sync-chunk` com steps curtos: planejar → `ingerir-lote-N` (25 msgs) → `persistir-midia-N-M` (4 mídias) → concluir
- Cron `*/2` — conclui syncs ociosos (sem chunk há 5 min; cobre RECENT incompleto)
- Hyperdrive + R2 (`whasap` + `whasap-cdn` para mídia)
- Criar a fila na Cloudflare: `wrangler queues create whasap-history-sync`
- Conclusão do sync: fase RECENT (`syncType` 2) com `progress=100`, ou idle no cron — **não** no bootstrap (`syncType` 0 @ 100)
- Inspecionar: `wrangler workflows instances describe whasap-history-sync-chunk latest`

## Setup local rápido

```bash
cp apps/web/.dev.vars.example apps/web/.dev.vars
cp apps/office/.dev.vars.example apps/office/.dev.vars
cp apps/webhook/.dev.vars.example apps/webhook/.dev.vars
cp apps/evolution-cleanup/.dev.vars.example apps/evolution-cleanup/.dev.vars
```

## Deploy

```bash
bun run validate:env
cd apps/site && bun run deploy
cd apps/web && bun run deploy
```
