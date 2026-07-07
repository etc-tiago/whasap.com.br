# Configuração de integrações — Whasap

Guia para configurar Asaas, Evolution API e Meta Cloud API.

**Infraestrutura de produção (vars, R2, Hyperdrive, Secrets Store, deploy):** [PRODUCAO.md](./PRODUCAO.md)

## Asaas (PIX + cartão)

1. Crie uma conta no [Asaas](https://www.asaas.com/) (use [Sandbox](https://sandbox.asaas.com/) em desenvolvimento).
2. Gere a **API Key** em Integrações → API.
3. Configure um **Webhook** apontando para `https://<seu-webhook-worker>/asaas`:
   - Eventos: `CHECKOUT_PAID`, `SUBSCRIPTION_CREATED`, `SUBSCRIPTION_DELETED`, `PAYMENT_OVERDUE`
   - Defina um `authToken` e use o mesmo valor em `ASAAS_WEBHOOK_TOKEN`
4. Cadastre o domínio do painel em **Configurações da conta → Informações** (necessário para URLs de callback do checkout).
5. Preços vêm de `mvpDefaults` (R$ 99/mês instância e pacote de conversas). Trial de 3 dias via `nextDueDate` no checkout.
6. Secrets nos workers:

   | Tipo | Nome | Workers |
   |------|------|---------|
   | Secrets Store | `ASSAS_API_KEY` → secret `ASSAS_API_KEY_ETC` no store `ASSAS_API_KEY_ETC` | `web`, `webhook` |

   ```bash
   wrangler secrets-store store list   # anote o store_id do store Asaas
   ```

   Em `wrangler.jsonc`, substitua `store_id` pelo UUID real. Workers `web` e `webhook` declaram o binding Asaas.

   Secrets Worker clássicos (`wrangler secret put`): `WEBHOOK_SECRET` e `ASAAS_WEBHOOK_TOKEN` (`webhook`).

7. Em desenvolvimento local, defina `ASSAS_API_KEY` e `ASAAS_SANDBOX=true` em `.dev.vars`.

Fluxo no painel: onboarding → QR Code → trial → checkout Asaas (PIX ou cartão).

**PIX recorrente:** o Asaas gera faturas mensais; o cliente paga cada uma via `invoiceUrl`. Cartão de crédito é debitado automaticamente.

## Webhooks WhatsApp

| Rota | Provider | Log R2 |
|------|----------|--------|
| `POST /evo` | Evolution API | `webhook/evo/{instance}/{date}/{event}-{time}-{id}.json` |
| `GET/POST /cloud` | Meta Cloud API | `webhook/cloud/{phoneNumberId}/{date}/{field}-{time}-{id}.json` |
| `POST /asaas` | Asaas | Postgres (`asaas_webhook_log`) |

Bucket R2: `whasap` (binding `R2` no worker webhook).

## CDN de mídia

Anexos recebidos (imagem, áudio, documento, vídeo) são baixados pelos webhooks e salvos no bucket R2 **`whasap-cdn`**, servidos em `https://cdn.whasap.com.br`.

| App | Domínio | Bucket R2 |
|-----|---------|-----------|
| `cdn` | `cdn.whasap.com.br` | `whasap-cdn` (binding `R2`) |
| `webhook` | `webhook.whasap.com.br` | `whasap-cdn` (binding `CDN_R2`, escrita) |

Chaves no R2: `media/{instanciaUuid}/{mensagemExternaId}.{ext}`

O painel expõe `mediaUrl` nas mensagens (campo `midiaR2Chave` no banco). Download de mídia Evolution usa `EVOLUTION_BASE_URL` / `EVOLUTION_API_KEY` do worker; Meta usa credenciais da instância no Neon.

```bash
cd apps/cdn && bun run deploy
```

## Evolution API (WhatsApp Business)

Motor único **Evolution GO** (whatsmeow), provedor `evolution` no Neon.

| Provedor | Motor | Identificação no Neon |
|----------|-------|------------------------|
| `evolution` | Evolution GO (whatsmeow) | `evolucao_instance_id`, `evolucao_token`, `evolucao_nome_instancia` |

Spec OpenAPI oficial: [`packages/evolution/swagger.json`](../packages/evolution/swagger.json) e [`packages/evolution/README.md`](../packages/evolution/README.md).

1. Suba Evolution GO na plataforma.
2. Configure nos workers `apps/web` e `apps/webhook`:
   - `EVOLUTION_BASE_URL` — URL do servidor Evolution
   - `EVOLUTION_API_KEY` — chave global (`apikey` header)
   - `WEBHOOK_URL` — ex. `https://webhook.whasap.com.br`
3. Webhooks em `POST /evo` (lookup por `instance` ou `instanceId`).
4. Token por instância gerado no provisionamento; chamadas `/send/*` usam esse token no header `apikey`.

Migração de instâncias antigas:

```sql
UPDATE instancia SET provedor = 'evolution'
WHERE provedor IN ('evolution_v2', 'evolution_go', 'evolution');
```

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
2. Verify token: mesmo valor de `WEBHOOK_SECRET` no worker webhook
3. Campos: `messages`, `message_template_status_update`

### Credenciais no painel

O admin da organização informa token e IDs no onboarding (`configurarCloud`). Os valores ficam na tabela `instancia` (`nuvem_token_acesso`, `nuvem_id_numero_telefone`, `nuvem_id_waba`) — não são expostos na API pública.

## Após alterações de schema

O desenvolvedor deve rodar:

```bash
bun run db:generate
bun run db:migrate
```
