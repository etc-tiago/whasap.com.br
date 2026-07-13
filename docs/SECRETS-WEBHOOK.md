# Secrets do worker `webhook`

Referência de **como gerar**, **requisitos** e **onde configurar** cada secret do app `apps/webhook`.

Infra geral (Hyperdrive, R2, deploy): [PRODUCAO.md](./PRODUCAO.md) · Integrações: [SETUP.md](./SETUP.md)

---

## Visão geral

| Nome | Obrigatório | Tipo | Onde configurar (produção) |
|------|-------------|------|----------------------------|
| `WHATSAPP_CLOUD_WEBHOOK_SECRET` | Sim | Worker secret | `wrangler secret put` + app Meta |
| `EVOLUTION_SECRETS_STORE` | Recomendado* | Secrets Store | binding em `wrangler.jsonc` (mesmo valor do `web`) |

\* Necessário se houver instâncias `evo` recebendo mídia inbound (download via `/message/downloadmedia`).

Vars **não secretas** no mesmo worker: ver [ENV.md](./ENV.md) (`CDN_URL` em `wrangler.jsonc`; dev em `.dev.vars`).

---

## `WHATSAPP_CLOUD_WEBHOOK_SECRET`

**Função:** token de verificação do webhook da **WhatsApp Cloud API** (Meta). Usado apenas no handshake `GET /cloud` (`hub.verify_token`).

**Quem valida:** `apps/webhook/src/index.ts` — compara o query param `hub.verify_token` com o secret.

### Requisitos

| Requisito | Detalhe |
|-----------|---------|
| Formato | String ASCII imprimível; sem quebras de linha |
| Entropia | Mínimo **32 caracteres** aleatórios (recomendado: 32–64) |
| Caracteres | Letras, números e símbolos seguros (`A–Z`, `a–z`, `0–9`, `_`, `-`) |
| Case-sensitive | Deve ser **idêntico** no Worker e no app Meta |
| Por ambiente | Valores **diferentes** em sandbox Meta vs produção |
| Não versionar | Nunca commitar em `.dev.vars`, `.env` ou código |

### Como gerar

```bash
openssl rand -base64 32
```

Ou UUIDs concatenados / gerador de senha do 1Password — o importante é alta entropia e unicidade.

### Onde configurar

1. **Worker (produção):**
   ```bash
   cd apps/webhook && wrangler secret put WHATSAPP_CLOUD_WEBHOOK_SECRET
   ```
2. **Meta for Developers** → seu app → **WhatsApp** → **Configuration** → **Webhook**:
   - **Callback URL:** `https://webhook.whasap.com.br/cloud`
   - **Verify token:** o **mesmo** valor do secret acima
3. **Local:** `apps/webhook/.dev.vars` (copie de `.dev.vars.example`)

### Erros comuns

- Verify token diferente entre Meta e Worker → `403 Forbidden` no `GET /cloud`
- Secret antigo `WEBHOOK_SECRET` ainda no dashboard após rename → redeploy com `WHATSAPP_CLOUD_WEBHOOK_SECRET`
- Espaço ou newline no final do valor ao colar no painel Meta

---

## `EVOLUTION_SECRETS_STORE` (opcional no schema, recomendado em uso)

**Função:** credenciais do servidor Evolution da plataforma (URL + `apikey`) — provisionamento, QR, envio e download de mídia inbound.

**Tipo:** Secrets Store da Cloudflare (JSON único, não vars/secrets separados).

### Requisitos

| Requisito | Detalhe |
|-----------|---------|
| Formato | JSON: `{ "baseUrl": "https://...", "apiKey": "..." }` |
| Valor | `baseUrl` = URL do servidor; `apiKey` = `GLOBAL_API_KEY` / header `apikey` |
| Workers | Mesmo secret em `apps/web` e `apps/webhook` |
| Binding | `EVOLUTION_SECRETS_STORE` no worker; secret `EVOLUTION_SECRETS_STORE` no store (nome histórico do store pode ser `ASSAS_API_KEY_ETC`) |

### Onde configurar

1. Criar secret no Secrets Store:
   ```bash
   wrangler secrets-store secret create $STORE_ID \
     --name EVOLUTION_SECRETS_STORE \
     --value '{"baseUrl":"https://evolution.example/","apiKey":"..."}' \
     --scopes workers
   ```
2. Binding em `apps/web/wrangler.jsonc` e `apps/webhook/wrangler.jsonc`
3. **Local:** `EVOLUTION_SECRETS_STORE={"baseUrl":"http://localhost:8080","apiKey":"dev-key"}` em `.dev.vars`

---

## Checklist rápido (produção)

- [ ] `WHATSAPP_CLOUD_WEBHOOK_SECRET` no Worker **e** Verify token idêntico no app Meta
- [ ] `EVOLUTION_SECRETS_STORE` (JSON `{ baseUrl, apiKey }`) se usar WhatsApp Comercial (`evo`)
- [ ] `.dev.vars` no `.gitignore`; apenas `.dev.vars.example` versionado
- [ ] Secrets de sandbox **não** reutilizados em produção

## Local

```bash
cp apps/webhook/.dev.vars.example apps/webhook/.dev.vars
# Edite os valores; nunca commite .dev.vars
cd apps/webhook && bun run dev
```
