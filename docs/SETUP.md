# Configuração de integrações — Whasap

Guia para configurar Asaas, Evolution API e Meta Cloud API em desenvolvimento e produção.

## Asaas (PIX + cartão)

1. Crie uma conta no [Asaas](https://www.asaas.com/) (use [Sandbox](https://sandbox.asaas.com/) em desenvolvimento).
2. Gere a **API Key** em Integrações → API.
3. Configure um **Webhook** apontando para `https://<seu-webhook-worker>/asaas`:
   - Eventos: `CHECKOUT_PAID`, `SUBSCRIPTION_CREATED`, `SUBSCRIPTION_DELETED`, `PAYMENT_OVERDUE`
   - Defina um `authToken` e use o mesmo valor em `ASAAS_WEBHOOK_TOKEN`
4. Cadastre o domínio do painel em **Configurações da conta → Informações** (necessário para URLs de callback do checkout).
5. Preços vêm de `mvpDefaults` (R$ 99/mês instância e pacote de conversas). Trial de 3 dias via `nextDueDate` no checkout.
6. Secrets nos workers:
   ```bash
   cd apps/web && wrangler secret put ASAAS_API_KEY
   cd apps/webhook && wrangler secret put ASAAS_WEBHOOK_TOKEN
   cd apps/webhook && wrangler secret put ASAAS_API_KEY
   ```
7. Em desenvolvimento local, defina `ASAAS_SANDBOX=true` em `.dev.vars`.

Fluxo no painel: onboarding → QR Code → trial → checkout Asaas (PIX ou cartão).

**PIX recorrente:** o Asaas gera faturas mensais; o cliente paga cada uma via `invoiceUrl`. Cartão de crédito é debitado automaticamente.

## Evolution API (WhatsApp Business)

1. Suba uma instância [Evolution API v2](https://doc.evolution-api.com/) com Redis.
2. Configure no worker `apps/web`:
   - `EVOLUTION_BASE_URL` — ex. `https://evolution.seudominio.com`
   - `EVOLUTION_API_KEY` — chave global da Evolution
   - `WEBHOOK_URL` — URL pública do worker webhook (ex. `https://webhook.whasap.com.br`)
3. A Evolution deve enviar webhooks para `https://<webhook-worker>/evolution`.
4. Opcional: binding **Secrets Store** como `EVOLUTION_SECRETS_STORE` para credenciais por instância.

## Meta Cloud API

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

1. URL: `https://<webhook-worker>/meta`
2. Verify token: mesmo valor de `WEBHOOK_SECRET` no worker webhook
3. Campos: `messages`, `message_template_status_update`

### Secrets

Binding `META_SECRETS_STORE` no worker `apps/web` para armazenar tokens por instância (`meta/{orgUuid}/{instanceUuid}`).

## Após alterações de schema

O desenvolvedor deve rodar:

```bash
bun run db:generate
bun run db:migrate
```
