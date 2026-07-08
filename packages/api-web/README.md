# @whasap/api-web

API ORPC do painel cliente (`webContract`). O Worker em `apps/web` expõe tudo em `/rpc/*` via `handleRpc` exportado por [`src/index.ts`](./src/index.ts).

Contratos: `@whasap/orpc/web`. Utilitários compartilhados (cookies RPC, OTP, e-mail): `@whasap/api-core`.

## Procedures vs handlers

A API segue **duas camadas** com responsabilidades fixas. Não misturar.

| Camada | Pasta | Responsabilidade |
|--------|-------|------------------|
| **Procedure** | `src/procedures/**` | Wiring ORPC: liga contrato → handler. **Sem** regra de negócio. |
| **Handler** | `src/handlers/**` | Domínio: DB, validações, OTP, sessão, e-mail, etc. |

### Procedure (só delegação)

Todas as procedures de autenticação seguem o mesmo formato — por exemplo [`entrar-fluxo.ts`](./src/procedures/autenticacao/entrar-fluxo.ts):

```ts
export default os.autenticacao.entrarFluxo.handler(({ context, input }) =>
  fluxoAutenticacaoHandlers.entrarFluxo(context, input),
);
```

O equivalente para login “clássico” está em [`entrar.ts`](./src/procedures/autenticacao/entrar.ts) → `autenticacaoHandlers.entrar`.

### Handler (lógica + helpers compartilhados)

A implementação fica no handler do módulo. Para fluxo OTP/hash, tudo está em [`auth-fluxo.ts`](./src/handlers/auth-fluxo.ts) (`fluxoAutenticacaoHandlers`).

**Por que `entrarFluxo` não vai para `entrar-fluxo.ts`?**

1. **Helpers compartilhados** — `entrarFluxo` usa `carregarFluxoPorHash`, `concluirEntradaFluxo`, etc. `concluirEntradaFluxo` também é usado por `consumirLinkMagico`.
2. **Consistência** — `iniciarFluxo`, `enviarOtpFluxo`, `cadastrarFluxo` e `obterFluxo` delegam todos para o mesmo módulo.
3. **Dependências** — OTP, rate limit, sessão e Drizzle pertencem ao handler, não ao arquivo de procedure.

A “função intermediária” (`fluxoAutenticacaoHandlers.entrarFluxo`) **não é aninhamento desnecessário**: é o mesmo padrão de `autenticacaoHandlers.entrar` em [`auth.ts`](./src/handlers/auth.ts).

```
ORPC (entrar-fluxo.ts)
  → fluxoAutenticacaoHandlers.entrarFluxo (auth-fluxo.ts)
    → concluirEntradaFluxo (helper privado do módulo)
```

### Anti-padrão

Colocar a lógica de negócio dentro de `src/procedures/**` “para simplificar” quebra o padrão do pacote, duplica imports e dificulta reutilizar helpers entre endpoints do mesmo fluxo.

Se quiser menos indireção **sem** mudar a arquitetura, prefira export nomeado no handler (`export async function entrarFluxo(...)`) em vez de método em objeto — a procedure continua sendo só wiring.

## Cookie de sessão JWT (`whasap_web`)

Handlers **não** emitem `Set-Cookie` manualmente.

1. Login/cadastro chama `createSession` (token opaco em `sessao`) e `atribuirSessaoRpc` (estado mutável no contexto ORPC — sobrevive ao clone do handler).
2. [`createRpcHandler`](../api-core/src/create-rpc-handler.ts) assina JWT (`jti` = token opaco) e envia `Set-Cookie` na resposta HTTP.
3. Resposta de login retorna **`{}`** — o cliente obtém usuário via `autenticacao.eu` após o cookie ser gravado.
4. Rotas **protegidas** sem JWT válido retornam **401 sem abrir Postgres**; rotas em `publicPaths` ([`src/index.ts`](./src/index.ts)) abrem DB normalmente.

Secret: `WEB_SESSION_JWT_SECRET` (`.dev.vars` local; `wrangler secret put` em produção).

O cliente em `apps/web` usa `credentials: "include"` ([`apps/web/src/lib/orpc.ts`](../../apps/web/src/lib/orpc.ts)). Após login, chamar `sincronizarSessaoPosAuth(queryClient)` ([`apps/web/src/lib/auth.ts`](../../apps/web/src/lib/auth.ts)).

## Módulos de autenticação

| Arquivo | Escopo |
|---------|--------|
| [`handlers/auth.ts`](./src/handlers/auth.ts) | Login/cadastro “clássico”, OTP por e-mail direto, `sair`, `eu` |
| [`handlers/auth-fluxo.ts`](./src/handlers/auth-fluxo.ts) | Fluxo por hash (`/~/{hash}`), OTP, link mágico |
| [`handlers/auth-session.ts`](./src/handlers/auth-session.ts) | Guards (`exigirAutenticacao`), mapeamento de sessão para saída ORPC |
| [`lib/session.ts`](./src/lib/session.ts) | `createSession`, resolução de cookie, constantes |

Rotas do painel: [`apps/web/ROUTES.md`](../../apps/web/ROUTES.md).

## Testes

### Integração RPC (Node)

Testes de integração RPC (Vitest) exercitam `handleRpc` in-process com Postgres real — cobrem cadastro/login clássico, fluxo wizard (`iniciarFluxo`) e emissão/validação do cookie JWT.

```bash
cd packages/api-web && bun run test
```

Helpers exportados em `@whasap/api-web/test` ([`src/test/`](./src/test/)); casos em [`src/integration/autenticacao.test.ts`](./src/integration/autenticacao.test.ts).

E2E do wizard no browser: [`apps/web/README.md`](../../apps/web/README.md) (`bun run test:browser`).

**Pré-requisitos:** `DATABASE_URL` na raiz (`.env`) e migrations aplicadas.

E2E browser do wizard: ver [`apps/web/README.md`](../../apps/web/README.md).

## Office

O painel admin usa `@whasap/api-office` com a **mesma** separação procedures/handlers e o mesmo mecanismo de cookie via `createRpcHandler`. Não compartilhar handlers entre web e office.
