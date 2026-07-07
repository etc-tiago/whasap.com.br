# Configuração de produção — Whasap

Guia completo de tudo que precisa existir na Cloudflare e em serviços externos antes do primeiro deploy em produção.

Para integrações (Asaas, Evolution, Meta), veja também [SETUP.md](./SETUP.md).

---

## Visão geral

| App | Worker (`wrangler.jsonc`) | Domínio | Postgres | R2 | Secrets Store |
|-----|---------------------------|---------|----------|----|---------------|
| `site` | `whasap-site` | `whasap.com.br` | — | — | — |
| `web` | `whasap-web` | `web.whasap.com.br` | Hyperdrive | — | Asaas |
| `office` | `whasap-office` | `office.whasap.com.br` | Hyperdrive | — | — |
| `webhook` | `whasap-webhook` | `webhook.whasap.com.br` | Hyperdrive | `whasap` + `whasap-cdn` | Asaas |
| `cdn` | `whasap-cdn` | `cdn.whasap.com.br` | — | `whasap-cdn` | — |

Rotas do worker **webhook**:

| Método | Rota | Uso |
|--------|------|-----|
| `POST` | `/evo` | Webhook Evolution API |
| `GET` / `POST` | `/cloud` | Webhook Meta Cloud API (verify + eventos) |
| `POST` | `/asaas` | Webhook Asaas (cobrança) |

---

## 1. Pré-requisitos (uma vez)

### 1.1 DNS

Registre os domínios na Cloudflare (ou aponte NS). Cada worker declara `custom_domain: true` no `wrangler.jsonc`; o deploy cria o registro automaticamente se a zona estiver na conta.

| Host | App |
|------|-----|
| `whasap.com.br` | site |
| `web.whasap.com.br` | web |
| `office.whasap.com.br` | office |
| `webhook.whasap.com.br` | webhook |
| `cdn.whasap.com.br` | cdn |

### 1.2 Postgres (Neon)

1. Crie o banco em [Neon](https://neon.tech).
2. Rode migrations **antes** do deploy dos workers:
   ```bash
   # Na máquina do desenvolvedor, com DATABASE_URL apontando para produção
   bun run db:migrate
   ```

### 1.3 Hyperdrive

Todos os workers com banco (`web`, `office`, `webhook`) usam o **mesmo** binding:

| Campo | Valor |
|-------|-------|
| Binding | `HYPERDRIVE` |
| ID no `wrangler.jsonc` | `c8f9852b6dc748489154722036fb4e48` |
| Acesso no código | `env.HYPERDRIVE.connectionString` |

Se o Hyperdrive ainda não existir na conta:

```bash
wrangler hyperdrive create whasap-db --connection-string "$DATABASE_URL_PRODUCAO"
# Copie o id retornado para wrangler.jsonc dos três workers (se diferente do atual)
```

### 1.4 Buckets R2

Crie na Cloudflare Dashboard → R2:

| Bucket | Uso | Workers |
|--------|-----|---------|
| `whasap` | Logs brutos de webhooks (`webhook/evo/...`, `webhook/cloud/...`) | `webhook` (binding `R2`) |
| `whasap-cdn` | Anexos de mensagens (`media/{instanciaUuid}/...`) | `webhook` (binding `CDN_R2`, escrita), `cdn` (binding `R2`, leitura) |

### 1.5 Secrets Store

Crie o store e o secret da API Asaas:

```bash
wrangler secrets-store store create ASSAS_API_KEY_ETC

# Liste o UUID do store
wrangler secrets-store store list
```

| Store (nome) | Secret no store | Binding no worker | Workers |
|--------------|-----------------|-------------------|---------|
| `ASSAS_API_KEY_ETC` | `ASSAS_API_KEY_ETC` | `ASSAS_API_KEY` | `web`, `webhook` |

Inserir valor:

```bash
STORE_ASSAS=76b096bc6b03460dabd7744ba277a1ee

wrangler secrets-store secret put $STORE_ASSAS ASSAS_API_KEY_ETC    # cola a API key do Asaas
```

Em cada `wrangler.jsonc`, substitua `store_id` pelo **UUID** real (não o nome do store).

### 1.6 Rate Limit (auth)

`web` e `office` compartilham o namespace de rate limit de login/OTP:

| Campo | Valor |
|-------|-------|
| Binding | `AUTH_RATE_LIMIT` |
| `namespace_id` no wrangler | `1001` |
| Limite | 3 requisições / 60 s por chave (email) |

Crie o namespace no dashboard Cloudflare (Workers → Rate limiting) se `1001` ainda não existir na conta, ou ajuste o `namespace_id` nos dois `wrangler.jsonc`.

### 1.7 Credenciais WhatsApp

| Provedor | Onde fica | Por instância? |
|----------|-----------|----------------|
| **Evolution** | Vars/secrets do worker (`EVOLUTION_BASE_URL`, `EVOLUTION_API_KEY`) | v2: `evolucao_nome_instancia`; GO: `evolucao_instance_id`, `evolucao_token`, `evolucao_nome_instancia` |
| **Meta Cloud** | Colunas em `instancia` (`nuvem_token_acesso`, `nuvem_id_numero_telefone`, `nuvem_id_waba`) — admin informa no onboarding | Sim |

O token Meta é dado coluna `text` no Postgres (não Secrets Store, não exposto na API).

---

## 2. Por app

### 2.1 `apps/site` — marketing

**Deploy:** `cd apps/site && bun run deploy`

#### Bindings

Nenhum (apenas Worker + domínio).

#### Variáveis de build (obrigatórias no CI / máquina de deploy)

Defina no ambiente **antes** de `vite build` (não vão no `wrangler.jsonc`):

| Variável | Produção | Descrição |
|----------|----------|-----------|
| `VITE_WEB_PANEL_URL` | `https://web.whasap.com.br` | Link “Acessar painel” no site |

Exemplo:

```bash
VITE_WEB_PANEL_URL=https://web.whasap.com.br bun run deploy
```

#### Secrets / vars Worker

Nenhum.

---

### 2.2 `apps/web` — painel cliente

**Deploy:** `cd apps/web && bun run deploy`

#### Bindings

| Tipo | Binding | Recurso |
|------|---------|---------|
| Hyperdrive | `HYPERDRIVE` | ID `c8f9852b6dc748489154722036fb4e48` |
| Rate Limit | `AUTH_RATE_LIMIT` | namespace `1001` |
| Secrets Store | `ASSAS_API_KEY` | store `ASSAS_API_KEY_ETC` → secret `ASSAS_API_KEY_ETC` |
| Assets | `./dist/client` | SPA estática |

#### Vars (`wrangler.jsonc` → `vars`) — valores de produção

| Var | Valor produção |
|-----|----------------|
| `WEB_URL` | `https://web.whasap.com.br` |
| `OFFICE_URL` | `https://office.whasap.com.br` |
| `WEBHOOK_URL` | `https://webhook.whasap.com.br` |
| `CDN_URL` | `https://cdn.whasap.com.br` |
| `EMAIL_FROM` | `noreply@whasap.com.br` (ou domínio verificado) |

#### Vars opcionais (dashboard ou `wrangler.jsonc`)

| Var | Quando usar |
|-----|-------------|
| `EVOLUTION_BASE_URL` | URL do servidor Evolution da plataforma |
| `ASAAS_SANDBOX` | **Não definir** em produção (ou `false`) |

#### Secrets Worker adicionais

| Secret | Descrição |
|--------|-----------|
| `EVOLUTION_API_KEY` | API key do servidor Evolution da plataforma |

#### Variáveis de build (SPA — embutidas no bundle)

| Variável | Produção | Descrição |
|----------|----------|-----------|
| `VITE_META_APP_ID` | App ID Meta | Embedded Signup (onboarding Cloud API) |
| `VITE_META_CONFIG_ID` | Config ID Embedded Signup | Idem |

```bash
VITE_META_APP_ID=... \
VITE_META_CONFIG_ID=... \
bun run deploy
```

---

### 2.3 `apps/office` — painel admin

**Deploy:** `cd apps/office && bun run deploy`

#### Bindings

| Tipo | Binding | Recurso |
|------|---------|---------|
| Hyperdrive | `HYPERDRIVE` | mesmo ID dos demais |
| Rate Limit | `AUTH_RATE_LIMIT` | namespace `1001` (compartilhado com `web`) |

#### Vars — produção

| Var | Valor produção |
|-----|----------------|
| `WEB_URL` | `https://web.whasap.com.br` |
| `OFFICE_URL` | `https://office.whasap.com.br` |
| `EMAIL_FROM` | `noreply@whasap.com.br` |

#### Build-time

Nenhuma `VITE_*` obrigatória (SSR).

#### Pós-deploy

Inserir ao menos um usuário em `office_usuario` (ver [README.md](../README.md)).

---

### 2.4 `apps/webhook` — webhooks

**Deploy:** `cd apps/webhook && bun run deploy`

#### Bindings

| Tipo | Binding | Recurso |
|------|---------|---------|
| Hyperdrive | `HYPERDRIVE` | mesmo ID |
| R2 | `R2` | bucket `whasap` |
| R2 | `CDN_R2` | bucket `whasap-cdn` |
| Secrets Store | `ASSAS_API_KEY` | store `ASSAS_API_KEY_ETC` → secret `ASSAS_API_KEY_ETC` |

#### Vars — produção

| Var | Valor produção |
|-----|----------------|
| `CDN_URL` | `https://cdn.whasap.com.br` |

#### Secrets Worker

| Secret | Descrição | Quem valida |
|--------|-----------|-------------|
| `WEBHOOK_SECRET` | Token de verificação Meta (`hub.verify_token`) | `GET /cloud` |
| `ASAAS_WEBHOOK_TOKEN` | `authToken` configurado no painel Asaas | header `asaas-access-token` em `POST /asaas` |

```bash
cd apps/webhook && wrangler secret put WEBHOOK_SECRET
cd apps/webhook && wrangler secret put ASAAS_WEBHOOK_TOKEN
```

Use o **mesmo** valor de `WEBHOOK_SECRET` no app Meta (Webhook → Verify token).

#### Vars opcionais

| Var | Uso |
|-----|-----|
| `EVOLUTION_BASE_URL` | Servidor Evolution da plataforma (download de mídia) |
| `ASAAS_SANDBOX` | **Não definir** em produção |

Secret `EVOLUTION_API_KEY` no worker webhook (mesmo valor do `web`).

---

### 2.5 `apps/cdn` — arquivos públicos

**Deploy:** `cd apps/cdn && bun run deploy`

#### Bindings

| Tipo | Binding | Recurso |
|------|---------|---------|
| R2 | `R2` | bucket `whasap-cdn` (somente leitura via Worker) |

#### Vars / Secrets

Nenhum.

URLs públicas: `https://cdn.whasap.com.br/media/{instanciaUuid}/{id}.{ext}`

---

## 3. Serviços externos (callbacks)

Configure **depois** que `webhook` estiver no ar.

| Serviço | URL | Credencial no Whasap |
|---------|-----|----------------------|
| **Asaas** webhook | `https://webhook.whasap.com.br/asaas` | `ASAAS_WEBHOOK_TOKEN` |
| **Meta** webhook | `https://webhook.whasap.com.br/cloud` | `WEBHOOK_SECRET` (verify token) |
| **Evolution** webhook | `https://webhook.whasap.com.br/evo` | — (Evolution envia para URL configurada no provisionamento) |

Asaas: eventos `CHECKOUT_PAID`, `SUBSCRIPTION_CREATED`, `SUBSCRIPTION_DELETED`, `PAYMENT_OVERDUE`.

Meta: campos `messages`, `message_template_status_update`.

Detalhes em [SETUP.md](./SETUP.md).

---

## 4. Ordem de deploy recomendada

```bash
# 1. Banco
bun run db:migrate

# 2. Infra de mídia e webhooks
cd apps/cdn && bun run deploy
cd apps/webhook && bun run deploy

# 3. Painéis e site (com vars de build)
cd apps/web && bun run deploy
cd apps/office && bun run deploy
cd apps/site && VITE_WEB_PANEL_URL=https://web.whasap.com.br bun run deploy
```

Ou na raiz: `bun run deploy` (Turbo), desde que as vars de build estejam no ambiente do CI.

---

## 5. Checklist de produção

### Cloudflare

- [ ] Zona DNS `whasap.com.br` na conta
- [ ] Hyperdrive `c8f9852b6dc748489154722036fb4e48` apontando para Neon produção
- [ ] R2 `whasap` criado
- [ ] R2 `whasap-cdn` criado
- [ ] Secrets Store `ASSAS_API_KEY_ETC` com secret `ASSAS_API_KEY_ETC`
- [ ] Rate limit namespace `1001` existe
- [ ] `store_id` nos `wrangler.jsonc` atualizados com UUIDs reais

### Workers — vars de produção

- [ ] `web`: `WEB_URL`, `OFFICE_URL`, `WEBHOOK_URL`, `CDN_URL`, `EMAIL_FROM`
- [ ] `office`: `WEB_URL`, `OFFICE_URL`, `EMAIL_FROM`
- [ ] `webhook`: `CDN_URL`

### Workers — secrets

- [ ] `webhook`: `WEBHOOK_SECRET`, `ASAAS_WEBHOOK_TOKEN`

### Build (CI)

- [ ] `site`: `VITE_WEB_PANEL_URL`
- [ ] `web`: `VITE_META_APP_ID`, `VITE_META_CONFIG_ID`


### Externo

- [ ] Asaas: webhook + domínio do painel cadastrado
- [ ] Meta: app, webhook, tokens
- [ ] Evolution GO provisionado, webhook `/evo`
- [ ] `office_usuario` com pelo menos um admin
- [ ] Email: `EMAIL_FROM` com domínio verificado (envio real ainda stub em `@whasap/api-core`)

---

## 6. Referência rápida — onde cada valor vive

| Valor | Onde configurar |
|-------|-----------------|
| URLs públicas dos apps | `vars` no `wrangler.jsonc` de cada app |
| API key Asaas | Secrets Store → binding `ASSAS_API_KEY` |
| Token webhook Asaas | `wrangler secret` → `ASAAS_WEBHOOK_TOKEN` no webhook |
| Sessão usuário / office | Token opaco em cookie + tabela `sessao` / `office_sessao` no Postgres |
| Verify token Meta | `wrangler secret` → `WEBHOOK_SECRET` no webhook |
| Connection string DB | Hyperdrive (nunca em var plain) |
| Credenciais WhatsApp por instância | Meta: `nuvem_*`; Evolution: `evolucao_instance_id` + `evolucao_token` + `evolucao_nome_instancia` |
| Servidor Evolution | `EVOLUTION_BASE_URL` + secret `EVOLUTION_API_KEY` nos workers `web` e `webhook` |
| Anexos de mensagem | R2 `whasap-cdn` (escrita webhook, leitura cdn) |
| Logs de webhook | R2 `whasap` |

---

## 7. Desenvolvimento local (contraste)

| Produção | Local |
|----------|-------|
| Hyperdrive remoto | `DATABASE_URL` na raiz + Hyperdrive local (`localConnectionString`) |
| Secrets Store | `.dev.vars` por app (`ASSAS_API_KEY`, etc.) |
| R2 remoto | Simulação local do Wrangler ou `remote: true` |
| `VITE_*` | `.env` / `.env.example` na raiz e em `apps/web` |

Arquivos de exemplo: `.env.example`, `apps/*/.dev.vars.example`, `apps/web/.env.example`.
