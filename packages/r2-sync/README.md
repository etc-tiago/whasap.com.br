# @whasap/r2-sync

Baixa logs JSON do bucket R2 `whasap` (`acao/` e `webhook/`) para uso local em testes e compatibilidade.

## Setup

1. Crie um token R2 com permissão de **leitura e escrita** em Cloudflare Dashboard → R2 → Manage R2 API Tokens (escrita necessária para `--purge-remote`)
2. Na raiz do monorepo: `bun install`
3. Copie `.env.example` → `.env.local` e preencha as credenciais
4. Execute da raiz: `bun run r2:sync`

## Uso

```bash
# Sync incremental (pula arquivos já existentes com mesmo tamanho)
bun run r2:sync

# Re-baixa tudo
bun run r2:sync -- --force

# Apaga pasta local e baixa do zero
bun run r2:sync -- --clean

# Simula limpeza + listagem sem gravar
bun run r2:sync -- --clean --dry-run

# Baixa e apaga no R2 os objetos que ficaram com cópia local
bun run r2:sync -- --purge-remote

# Simula purge remoto
bun run r2:sync -- --purge-remote --dry-run
```

Arquivos são gravados em `packages/r2-sync/json/`, espelhando as chaves R2.

## Promover para fixtures

### Evolution (`packages/evolution/src/fixtures/respostas/`)

De um log `json/acao/.../instance_create/....json`, extraia o campo `responseBody` e salve como `instance/create/case-N.json`.

### Webhooks

De um log `json/webhook/evo/...json`, extraia o campo `raw` (payload original) para futuros fixtures de parser.

## Variáveis de ambiente

| Variável | Obrigatória | Default |
|----------|-------------|---------|
| `CLOUDFLARE_ACCOUNT_ID` | sim | — |
| `R2_ACCESS_KEY_ID` | sim | — |
| `R2_SECRET_ACCESS_KEY` | sim | — |
| `R2_BUCKET` | não | `whasap` |
| `R2_OUTPUT_DIR` | não | `./json` |
| `R2_PREFIXES` | não | `acao/,webhook/` |
| `R2_CONCURRENCY` | não | `8` |

Configuração em `.env.local` (cascade: `.env` → `.env.local`).
