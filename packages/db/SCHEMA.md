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
| `relacoes.ts` | `relations()` Drizzle para `db.query.*` com `with` / filtros relacionais |

## Convenção de nomes

- **Tabelas SQL:** singular em pt-BR (`organizacao`, `instancia`, `contato`, `conversa`, `mensagem`)
- **Exports TS:** camelCase singular (`organizacao`, `instancia`, `contato`, `conversa`, `mensagem`)
- **Colunas TS:** camelCase pt-BR; mapeadas para `snake_case` no Postgres via `casing: "snake_case"` em `drizzle.config.ts` e `criarDb()`
- **Funções exportadas:** nomes em pt-BR com JSDoc (`criarDb`, `resolverIdInterno`, `comTimestampsCriacao`, etc.)

## Identificadores

- **PK interna:** `id serial` — usada em FKs entre tabelas; não expor na API
- **ID exportável:** coluna `uuid` (unique) — único id visível na API/ORPC
- Tabelas sem exposição na API (`sessao`, `codigo_otp`, agregados internos, webhooks) não têm `uuid`

## Timestamps e soft-delete

- **`criadoEm` / `atualizadoEm`:** preenchidos pelos helpers `comTimestampsCriacao` / `comTimestampAtualizacao`
- **`excluidoEm`:** exclusão lógica; filtrar com `isNull(excluidoEm)` em reads e usar `marcarExclusaoLogica()` em deletes lógicos
- Tabelas só com `criadoEm` (`sessao`, `codigo_otp`, `webhook_evento`, etc.): usar `comCriadoEm` ou `criadoEm: new Date()` inline
- **`instancia_addon.ativo`:** estado do addon Asaas, não é soft-delete

## Acesso ao banco

`criarDb(connectionString)` retorna `{ db }`:

- **`db.query.*`:** reads com `columns` via presets `colunas*` de `colunas.ts` — nunca retornar linha completa sem necessidade
- **Relações `with:`:** usar `incluir*` (ex.: `incluirOrganizacaoPublica`) com `filtroNaoExcluido` em tabelas com `excluidoEm`
- **`db.insert` / `db.update` / `db.delete`:** writes; usar helpers de timestamp/soft-delete conforme a tabela
- **`db.select`:** agregações (`count`, joins complexos em relatórios/admin) e SQL explícito quando necessário

`resolverIdInterno(db, 'organizacao', uuidPublico)` converte uuid exportável → `id` interno.

## Índices

- Únicos de coluna única: `campo().unique()` (ex.: `email`, `token`, `asaas_id_assinatura`)
- Compostos via `index()` / `unique().on(...)` no callback de `pgTable`
- FKs frequentes indexadas: `organizacao_id`, `instancia_id`, `conversa_id`, `usuario_id`, etc.

## Instâncias WhatsApp (`instancias.ts`)

| `provedor` | Descrição |
|------------|-----------|
| `cloud_api` | Meta Cloud API — credenciais em `nuvem_*` |
| `evolution` | Evolution GO (whatsmeow) — `evolucao_instance_id`, `evolucao_token`, `evolucao_nome_instancia` |

Migração:

```sql
UPDATE instancia SET provedor = 'evolution'
WHERE provedor IN ('evolution_v2', 'evolution_go', 'evolution');
```

**Desenvolvedor:** após alterações de schema, rodar `bun run db:generate` e `bun run db:migrate` (renomear tabelas/colunas, enums, índices).
