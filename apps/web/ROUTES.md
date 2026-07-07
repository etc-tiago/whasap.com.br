# Rotas — web.whasap.com.br (painel do cliente)

SPA client-first: rotas de página no browser; dados via `/rpc` (server route in-process, `@whasap/api-web`).

Sem autenticação: **qualquer URL** exibe apenas login/cadastro (`AuthPage`).

Com autenticação: o `organizacaoHash` (uuid da organização) vem da URL e é passado nas chamadas ORPC via `orgInput()`.

| Rota | Descrição |
|------|-----------|
| `/` | Redirect: sem org → `/integracao`; com org → `/{uuid}/` (membership mais antiga) |
| `/integracao` | Criar organização (primeira ou adicional) |
| `/{uuid}/` | Home — inbox / empty state |
| `/{uuid}/instancias` | Lista e contratação de instâncias (Asaas) |
| `/{uuid}/integracao` | Config pós-pagamento (QR Evolution / Cloud API) |
| `/{uuid}/inbox/$instanceId` | Inbox por instância |
| `/{uuid}/relatorios` | BI (admin + analista) |
| `/{uuid}/equipe` | Membros e convites (admin) |
| `/{uuid}/ajustes` | Org + cobrança Asaas |
| `/convite/$token` | Aceitar convite → redirect `/{uuid}/` |

| `/rpc`, `/rpc/*` | ORPC embutido (server-only) |
