# Rotas — web.whasap.com.br (painel do cliente)

SPA client-first: rotas de página no browser; dados via `/rpc` (server route in-process, `@whasap/api-web`).

Sem autenticação: **qualquer URL** exibe apenas login/cadastro (`AuthPage`).

Com autenticação: layout com sidebar + conteúdo na rota solicitada.

| Rota | Descrição |
|------|-----------|
| `/` | Home — inbox / empty state |
| `/instancias` | Lista e contratação de instâncias (Asaas) |
| `/onboarding` | Config pós-pagamento (QR Evolution / Cloud API) |
| `/inbox/$instanceId` | Inbox por instância |
| `/relatorios` | BI (admin + analista) |
| `/ajustes` | Org + cobrança Asaas |

| `/rpc`, `/rpc/*` | ORPC embutido (server-only) |

Rotas futuras entram no mesmo layout `_panel` (ex.: `/equipe`, `/tags`).
