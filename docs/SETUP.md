# Configuração de integrações — Whasap

Guia para configurar Evolution API e Meta Cloud API.

**Infraestrutura de produção (vars, R2, Hyperdrive, Secrets Store, deploy):** [PRODUCAO.md](./PRODUCAO.md) · **Vars vs secrets:** [ENV.md](./ENV.md)

## Cobrança

Cobrança **manual** — teste de 7 dias e boleto por uso após o período, conforme [termo de adesão](https://whasap.com.br/legal#adesao). Valores de referência em `mvpDefaults.billing` (planos Starter→Enterprise por contato único, conexão adicional, pacotes de 100 contatos). Não há integração Asaas nem checkout in-app.

## Webhooks WhatsApp

| Rota | Provider | Log R2 |
|------|----------|--------|
| `POST /evo` | Evolution API | `webhook/evo/{instance}/{date}/{event}-{time}-{id}.json` |
| `GET/POST /cloud` | Meta Cloud API | `webhook/cloud/{phoneNumberId}/{date}/{field}-{time}-{id}.json` |

Bucket R2: `whasap` (binding `R2` no worker webhook).

## CDN de mídia

Anexos recebidos (imagem, áudio, documento, vídeo) são baixados pelos webhooks e salvos no bucket R2 **`whasap-cdn`**, servidos em `https://cdn.whasap.com.br`.

| App | Domínio | Bucket R2 |
|-----|---------|-----------|
| `cdn` | `cdn.whasap.com.br` | `whasap-cdn` (binding `R2`) |
| `webhook` | `webhook.whasap.com.br` | `whasap-cdn` (binding `CDN_R2`, escrita) |

Chaves no R2: `media/{instanciaUuid}/{mensagemExternaId}.{ext}`

O painel expõe `mediaUrl` nas mensagens (campo `midiaR2Chave` no banco). Download de mídia Evolution usa `EVOLUTION_SECRETS_STORE` do worker; Meta usa credenciais da instância no Neon.

```bash
cd apps/cdn && bun run deploy
```

## Evolution API (WhatsApp Business)

Motor único **Evolution GO** (whatsmeow), provedor `evo` no Neon.

| Provedor | Motor | Identificação no Neon |
|----------|-------|------------------------|
| `evo` | Evolution GO (whatsmeow) | `instancia_evo`: `nomeInstancia`, `instanceId`, `token` |

Spec OpenAPI oficial: [`packages/evolution/swagger.json`](../packages/evolution/swagger.json) e [`packages/evolution/README.md`](../packages/evolution/README.md).

1. Suba Evolution GO na plataforma.
2. Configure nos workers `apps/web`, `apps/webhook` e `apps/office` (debug):
   - `EVOLUTION_SECRETS_STORE` — JSON `{ "baseUrl", "apiKey" }` (Secrets Store; local em `.dev.vars`)
   - `WEBHOOK_URL` — ex. `https://webhook.whasap.com.br` (só no `web`)
   - `EVOLUTION_DEBUG` — `true` no `.dev.vars` do `web` para expor `_debug` em `obterQr` / `statusConexao` (default `false` em produção)
3. Webhooks em `POST /evo` (lookup por `instance` ou `instanceId`).
4. Token por instância gerado no provisionamento; chamadas `/send/*` usam esse token no header `apikey`.

Fluxo detalhado (status banco vs Evolution vs webhook): [FLUXO-INSTANCIA-EVOLUTION.md](./FLUXO-INSTANCIA-EVOLUTION.md).

Office: worker com binding R2 `whasap` para consultar logs de webhook e endpoint `administracao.instancias.estadoEvolution`.

## Meta Cloud API

Collection Postman de referência: [`packages/meta/whatsapp-cloud-api.postman_collection.json`](../packages/meta/whatsapp-cloud-api.postman_collection.json) e [`packages/meta/README.md`](../packages/meta/README.md).

### App Meta

1. [Meta for Developers](https://developers.facebook.com/) → criar app tipo **Business**.
2. Adicione o produto **WhatsApp**.
3. Em **WhatsApp > API Setup**, anote App ID e gere um token de longa duração (System User).

### Embedded Signup (recomendado)

1. Em **WhatsApp > Embedded Signup**, crie uma configuração.
2. Variáveis no frontend (`apps/web/.env`):
   ```
   VITE_META_APP_ID=
   VITE_META_CONFIG_ID=
   ```
3. Callback URL: URL do painel onde o SDK Meta retorna `waba_id` e `phone_number_id`.

### Modo manual

No onboarding, aba **Manual**:
- **Phone Number ID** — ID do número no Meta Business Suite
- **WABA ID** — WhatsApp Business Account ID
- **Access Token** — token permanente com `whatsapp_business_messaging`

### Webhook Meta

1. URL: `https://<webhook-worker>/cloud`
2. Verify token: **UUID da conexão** Whasap (`instancia.uuid`) — copiar no painel (integração Cloud API)
3. Campos: `messages`, `message_template_status_update`

Ver [SECRETS-WEBHOOK.md](./SECRETS-WEBHOOK.md).

### Credenciais no painel

O admin da organização informa token e IDs no onboarding (`configurarCloud`). Os valores ficam na tabela `instancia_meta_cloud` — não são expostos na API pública.

## Após alterações de schema

O desenvolvedor deve rodar:

```bash
bun run db:generate
bun run db:migrate
```
