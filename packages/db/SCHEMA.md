# Schema Drizzle — Whasap

Arquivos em `packages/db/src/schema/`:

| Módulo | Tabelas |
|--------|---------|
| `autenticacao.ts` | `usuario`, `sessao`, `codigo_otp` |
| `office.ts` | `office_usuario`, `office_sessao` |
| `organizacoes.ts` | `organizacao`, `organizacao_membro`, `organizacao_convite` |
| `instancias.ts` | `instancia`, `instancia_addon` |
| `mensageria.ts` | `contato`, `contato_tag`, `contato_tag_atribuicao`, `conversa`, `mensagem`, `mensagem_template`, `conversa_anotacao`, `resposta_rapida`, `uso_mensal`, `uso_mensal_contato` |
| `webhook.ts` | `webhook_evento`, `asaas_webhook_registro` |
| `relacoes.ts` | `relations()` Drizzle para better-drizzle `include` / filtros relacionais |

## Convenção de nomes

- **Tabelas SQL:** singular em pt-BR (`organizacao`, `instancia`, `contato`, `conversa`, `mensagem`)
- **Exports TS / delegates `client.*`:** camelCase singular (`organizacao`, `instancia`, `contato`, `conversa`, `mensagem`)
- **Colunas TS:** camelCase pt-BR; mapeadas para `snake_case` no Postgres via `casing: "snake_case"` em `drizzle.config.ts` e `createDb()`
- **Sem strings redundantes:** preferir `nome: text()` em vez de `nome: text("nome")` quando a chave TS já define o nome da coluna

## Identificadores

- **PK interna:** `id serial` — usada em FKs entre tabelas
- **ID exportável:** coluna `uuid` (unique) — único id visível na API/ORPC
- Tabelas sem exposição na API (`sessao`, `codigo_otp`, agregados internos, webhooks) não têm `uuid`

## Timestamps e soft-delete

- **`criadoEm` / `atualizadoEm`:** em todo o schema (colunas `criado_em` / `atualizado_em`); preenchidos pelo plugin `@better-drizzle/timestamps` (`mode: 'app'`)
- **`excluidoEm`:** exclusão lógica nas entidades exportáveis + `office_usuario`; filtrado por `@better-drizzle/soft-delete` (padrão: ocultar excluídos)
- Tabelas só com `criadoEm` (`sessao`, `codigo_otp`, `webhook_evento`, etc.) não têm `atualizadoEm` — o plugin ignora automaticamente
- **`instancia_addon.ativo`:** estado do addon Asaas, não é soft-delete

## Client better-drizzle

`createDb(connectionString)` retorna `{ db, client }`:

- **`client.*`:** CRUD, lookup por `uuid`, relations, soft-delete — preferir nos handlers
- **`db`:** agregações pesadas (`count`, joins complexos em relatórios/admin) e SQL cru quando necessário

Delegates principais: `client.usuario`, `client.organizacao`, `client.organizacaoMembro`, `client.instancia`, `client.conversa`, `client.mensagem`, `client.officeUsuario`, `client.officeSessao`, `client.codigoOtp`, `client.sessao`, etc.

`resolveInternalId(client, 'organizacao', publicUuid)` converte uuid exportável → `id` interno.

## Índices

- Únicos de coluna única: `campo().unique()` (ex.: `email`, `token`, `asaas_id_assinatura`)
- Compostos via `index()` / `unique().on(...)` no callback de `pgTable`
- FKs frequentes indexadas: `organizacao_id`, `instancia_id`, `conversa_id`, `usuario_id`, etc.

**Desenvolvedor:** após alterações de schema, rodar `bun run db:generate` e `bun run db:migrate` (renomear tabelas/colunas, enums, índices).
