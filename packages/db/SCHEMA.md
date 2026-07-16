# Schema Drizzle — Whasap

Arquivos em `packages/db/src/schema/`:

| Módulo | Tabelas |
|--------|---------|
| `autenticacao.ts` | `usuario`, `sessao`, `codigo_otp` |
| `office.ts` | `office_usuario`, `office_sessao` |
| `organizacoes.ts` | `organizacao`, `organizacao_membro`, `organizacao_convite` |
| `instancias.ts` | `instancia` |
| `instancia-evo.ts` | `instancia_evo` |
| `instancia-meta-cloud.ts` | `instancia_meta_cloud` |
| `mensageria.ts` | `contato`, `contato_tag`, `contato_tag_atribuicao`, `conversa`, `mensagem`, `mensagem_template`, `conversa_anotacao`, `resposta_rapida`, `resposta_rapida_item`, `uso_mensal`, `uso_mensal_contato` |
| `webhook.ts` | `webhook_evento` |
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

## Organização (`organizacoes.ts`)

Cadastro fiscal e aceite do termo de adesão na criação da org (`/integracao`):

| Coluna TS | Descrição |
|-----------|-----------|
| `documentoFiscal` | CNPJ (somente dígitos) |
| `tipoDocumento` | `"cnpj"` |
| `razaoSocial` | Razão social |
| `telefoneWhatsapp` | WhatsApp de contato (faturamento / suporte — não é o número da conexão) |
| `aceiteAdesaoEm` | Timestamp do aceite do termo |
| `aceiteAdesaoVersao` | Versão do termo (`mvpDefaults.legal.adesaoVersao`) |
| `limiteConversas` | Cota mensal de conversas únicas da org |

Cobrança é manual (teste de 7 dias, depois boleto por uso — ver termo em `whasap.com.br/legal#adesao`). Não há campos Asaas; o trial é política comercial (não há coluna no schema).

## Acesso ao banco

`criarDb(connectionString)` retorna `{ db }`:

- **`db.query.*`:** reads com `columns` via presets `colunas*` de `colunas.ts` — nunca retornar linha completa sem necessidade
- **Relações `with:`:** usar `incluir*` (ex.: `incluirOrganizacaoPublica`) com `filtroNaoExcluido` em tabelas com `excluidoEm`
- **`db.insert` / `db.update` / `db.delete`:** writes; usar helpers de timestamp/soft-delete conforme a tabela
- **`db.select`:** agregações (`count`, joins complexos em relatórios/admin) e SQL explícito quando necessário

`resolverIdInterno(db, 'organizacao', uuidPublico)` converte uuid exportável → `id` interno.

## Índices

- Únicos de coluna única: `campo().unique()` (ex.: `email`, `token`, `slug`)
- Compostos via `index()` / `unique().on(...)` no callback de `pgTable`
- FKs frequentes indexadas: `organizacao_id`, `instancia_id`, `conversa_id`, `usuario_id`, etc.

## Instâncias WhatsApp

| `provedor` | Tabela auxiliar | Descrição |
|------------|-----------------|-----------|
| `meta_cloud` | `instancia_meta_cloud` | Meta Cloud API — credenciais em `nuvem_*` |
| `evo` | `instancia_evo` | Evolution GO (whatsmeow) — `nomeInstancia`, `instanceId`, `token` |

### Status (`instancia.status`)

| Valor | Uso |
|-------|-----|
| `pending_connection` | Criada, aguardando provisionamento |
| `provisioning` | Provisionamento em andamento |
| `connected` | Conectada (Evolution sempre grava `connected` ao parear) |
| `disconnected` | Sessão encerrada |
| `deactivated` | Desativada |
| `pending_payment` | **Legado** — permanece no enum Postgres; o app não grava mais |

Colunas operacionais relevantes:

- `sessaoRemotaLiberadaEm` — cleanup Evolution liberou a sessão remota (não é soft-delete; a row permanece para reconectar na mesma uuid)
- `conectadoEm` / `desconectadoEm` — timestamps de conexão
- `conversa.ultimaMensagemCorpo` / `ultimaMensagemTipo` — preview denormalizado da lista da inbox (backfill: `bun run db:sync-ultima-mensagem`)

**Desenvolvedor:** após alterações de schema, rodar `bun run db:generate` e `bun run db:migrate` (renomear tabelas/colunas, enums, índices).
