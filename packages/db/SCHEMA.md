# Schema Drizzle — Whasap

Arquivos em `packages/db/src/schema/`:

| Módulo | Tabelas |
|--------|---------|
| `autenticacao.ts` | `usuario`, `sessao`, `codigo_otp` |
| `office.ts` | `office_usuario`, `sessao_office` |
| `organizacoes.ts` | `organizations`, `organization_members`, `organization_invites` |
| `instancias.ts` | `instances`, `instance_addons` |
| `mensageria.ts` | `contacts`, `contact_tags`, `contact_tag_assignments`, `conversations`, `messages`, `message_templates`, `conversation_notes`, `quick_replies`, `monthly_usage`, `monthly_usage_contacts` |
| `webhook.ts` | `webhook_events`, `asaas_webhook_log` |
| `relacoes.ts` | `relations()` Drizzle para better-drizzle `include` / filtros relacionais |

## Identificadores

- **PK interna:** `id serial` — usada em FKs entre tabelas
- **ID exportável:** coluna `uuid` (unique) — único id visível na API/ORPC
- Tabelas sem exposição na API (`sessao`, `codigo_otp`, agregados internos, webhooks) não têm `uuid`

## Timestamps e soft-delete

- **`criadoEm` / `atualizadoEm`:** em todo o schema (colunas `criado_em` / `atualizado_em`); preenchidos pelo plugin `@better-drizzle/timestamps` (`mode: 'app'`)
- **`excluidoEm`:** exclusão lógica nas entidades exportáveis + `office_usuario`; filtrado por `@better-drizzle/soft-delete` (padrão: ocultar excluídos)
- Tabelas só com `criadoEm` (`sessao`, `codigo_otp`, `webhook_events`, etc.) não têm `atualizadoEm` — o plugin ignora automaticamente
- **`instance_addons.active`:** estado do addon Asaas, não é soft-delete

## Client better-drizzle

`createDb(connectionString)` retorna `{ db, client }`:

- **`client.*`:** CRUD, lookup por `uuid`, relations, soft-delete — preferir nos handlers
- **`db`:** agregações pesadas (`count`, joins complexos em relatórios/admin) e SQL cru quando necessário

Delegates principais: `client.usuario`, `client.organizations`, `client.organizationMembers`, `client.instances`, `client.conversations`, `client.messages`, `client.officeUsuario`, `client.codigoOtp`, `client.sessao`, etc.

`resolveInternalId(client, 'usuario', publicUuid)` converte uuid exportável → `id` interno.

**Desenvolvedor:** após alterações de schema, rodar `bun run db:generate` e `bun run db:migrate` (renomear timestamps, remover `ativo`/`active`, adicionar `excluido_em`).
