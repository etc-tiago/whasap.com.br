# Secrets do worker `webhook`

Referência de **como gerar**, **requisitos** e **onde configurar** cada secret do app `apps/webhook`.

Infra geral (Hyperdrive, R2, deploy): [PRODUCAO.md](./PRODUCAO.md) · Integrações: [SETUP.md](./SETUP.md)

---

## Visão geral

| Nome | Obrigatório | Tipo | Onde configurar (produção) |
|------|-------------|------|----------------------------|
| `WHATSAPP_CLOUD_WEBHOOK_SECRET` | Sim | Worker secret | `wrangler secret put` + app Meta |
| `ASAAS_WEBHOOK_TOKEN` | Sim | Worker secret | `wrangler secret put` + painel Asaas |
| `ASSAS_API_KEY` | Sim | Secrets Store | binding em `wrangler.jsonc` |
| `EVOLUTION_SECRETS_STORE` | Recomendado* | Secrets Store | binding em `wrangler.jsonc` (mesmo valor do `web`) |

\* Necessário se houver instâncias `evolution` recebendo mídia inbound (download via `/message/downloadmedia`).

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

## `ASAAS_WEBHOOK_TOKEN`

**Função:** autenticação dos webhooks de cobrança do **Asaas** (`POST /asaas`).

**Quem valida:** header `asaas-access-token`, comparação em tempo constante (`timingSafeEqual`) em `apps/webhook/src/index.ts`.

### Requisitos

| Requisito | Detalhe |
|-----------|---------|
| Formato | String definida por você no painel Asaas (`authToken`) |
| Entropia | Mínimo **32 caracteres** aleatórios (recomendado) |
| Case-sensitive | Deve ser **idêntico** no Worker e no webhook Asaas |
| Por ambiente | Sandbox Asaas e produção com tokens **distintos** |
| Não versionar | Nunca commitar |

### Como gerar

Mesmo critério do verify token Meta:

```bash
openssl rand -hex 32
```

### Onde configurar

1. **Asaas** → Integrações → Webhooks → criar/editar webhook:
   - **URL:** `https://webhook.whasap.com.br/asaas`
   - **Token de autenticação** (`authToken`): valor que você escolheu
   - Eventos: `CHECKOUT_PAID`, `SUBSCRIPTION_CREATED`, `SUBSCRIPTION_DELETED`, `PAYMENT_OVERDUE`
2. **Worker:**
   ```bash
   cd apps/webhook && wrangler secret put ASAAS_WEBHOOK_TOKEN
   ```
   Use o **mesmo** valor do `authToken` do Asaas.
3. **Local:** `apps/webhook/.dev.vars`

### Erros comuns

- Token só no Asaas ou só no Worker → `401 Invalid signature`
- Webhook apontando para URL errada ou worker não deployado
- Misturar credenciais sandbox (`sandbox.asaas.com`) com produção

---

## `ASSAS_API_KEY` (Secrets Store)

**Função:** chave de API do Asaas para criar clientes, checkouts e assinaturas (usada em `handleAsaasWebhook` e fluxos de billing).

**Tipo:** Secrets Store da Cloudflare (não é `wrangler secret put` clássico).

### Requisitos

| Requisito | Detalhe |
|-----------|---------|
| Formato | Chave Asaas (`$aact_...` em produção; sandbox tem prefixo próprio) |
| Origem | Asaas → Integrações → API → gerar chave |
| Por ambiente | Chave **sandbox** em dev; chave **produção** em prod |
| Binding | `ASSAS_API_KEY` no worker; secret `ASSAS_API_KEY_ETC` no store `ASSAS_API_KEY_ETC` |

### Onde configurar

1. Criar secret no [Secrets Store](https://developers.cloudflare.com/secrets-store/) da conta
2. Atualizar `store_id` em `apps/webhook/wrangler.jsonc` e `apps/web/wrangler.jsonc`
3. **Local:** `ASSAS_API_KEY=...` em `.dev.vars` de `web` e `webhook`

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
| Binding | `EVOLUTION_SECRETS_STORE` no worker; secret `EVOLUTION_SECRETS_STORE` no store |

### Onde configurar

1. Criar secret no Secrets Store (mesmo store Asaas ou outro):
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
- [ ] `ASAAS_WEBHOOK_TOKEN` no Worker **e** auth token idêntico no webhook Asaas
- [ ] `ASSAS_API_KEY` no Secrets Store com binding nos workers `web` e `webhook`
- [ ] `EVOLUTION_SECRETS_STORE` (JSON `{ baseUrl, apiKey }`) se usar WhatsApp Comercial (`evolution`)
- [ ] `.dev.vars` no `.gitignore`; apenas `.dev.vars.example` versionado
- [ ] Secrets de sandbox **não** reutilizados em produção

## Local

```bash
cp apps/webhook/.dev.vars.example apps/webhook/.dev.vars
# Edite os valores; nunca commite .dev.vars
cd apps/webhook && bun run dev
```
