# Secrets do worker `webhook`

Referência de **como gerar**, **requisitos** e **onde configurar** cada secret do app `apps/webhook`.

Infra geral (Hyperdrive, R2, deploy): [PRODUCAO.md](./PRODUCAO.md) · Integrações: [SETUP.md](./SETUP.md)

---

## Visão geral

| Nome | Obrigatório | Tipo | Onde configurar (produção) |
|------|-------------|------|----------------------------|
| `EVOLUTION_SECRETS_STORE` | Recomendado* | Secrets Store | binding em `wrangler.jsonc` (mesmo valor do `web`) |
| `CDN_HMAC_SECRET` | Opcional | Worker secret | `wrangler secret put` (HMAC de mídia CDN) |

\* Necessário se houver instâncias `evo` recebendo mídia inbound (download via `/message/downloadmedia`).

Vars **não secretas** no mesmo worker: ver [ENV.md](./ENV.md) (`CDN_URL` em `wrangler.jsonc`; dev em `.dev.vars`).

---

## Verify token Meta (sem secret global)

O handshake `GET /cloud` (`hub.verify_token`) **não** usa variável de ambiente.

**Valor:** UUID da conexão Whasap (`instancia.uuid`), exibido no painel em integração Cloud API / WhatsApp / Ajustes → Conexões.

**Quem valida:** `apps/webhook` — busca `instancia` com `uuid = token`, `provedor = meta_cloud` e não excluída.

### Onde configurar (Meta)

1. Crie a conexão Cloud API no painel Whasap (o UUID já existe).
2. **Meta for Developers** → app → **WhatsApp** → **Configuration** → **Webhook**:
   - **Callback URL:** `https://webhook.whasap.com.br/cloud`
   - **Verify token:** o UUID da conexão (copiar no painel)
   - **Webhook fields:** `messages`, `message_template_status_update`

### Erros comuns

- Verify token ≠ UUID da conexão → `403 Forbidden` no `GET /cloud`
- UUID de conexão Evolution ou soft-deleted → `403`
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

- [ ] No Meta: Verify token = UUID da conexão Cloud API (painel Whasap)
- [ ] `EVOLUTION_SECRETS_STORE` (JSON `{ baseUrl, apiKey }`) se usar WhatsApp Comercial (`evo`)
- [ ] `.dev.vars` no `.gitignore`; apenas `.dev.vars.example` versionado
- [ ] Secrets de sandbox **não** reutilizados em produção

## Local

```bash
cp apps/webhook/.dev.vars.example apps/webhook/.dev.vars
# Edite os valores; nunca commite .dev.vars
cd apps/webhook && bun run dev
```
