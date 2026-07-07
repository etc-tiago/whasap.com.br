# Auth multi-step — web.whasap.com.br

SPA client-first: rotas de página no browser; dados via `/rpc` (server route in-process, `@whasap/api-web`).

Sem autenticação: redirect para **`/~`** (fluxo multi-step). Exceção: `/convite/$token`.

Com autenticação: o `organizacaoHash` (uuid da organização) vem da URL e é passado nas chamadas ORPC via `orgInput()`.

## Entrada e autenticação (`/~`)

| Rota | Descrição |
|------|-----------|
| `/~` | Informa e-mail → `iniciarFluxo` |
| `/~/{hash}` | Login: envia OTP automaticamente; valida com `entrarFluxo` |
| `/~/email/{emailHash}` | Cadastro: e-mail sem conta; OTP ao clicar "Criar conta"; `cadastrarFluxo` com nome derivado do e-mail |
| `/~/email/{emailHash}/bloqueado` | Bloqueio após 10 OTPs pedidos ou 10 tentativas inválidas |

Pós-login: `/` → org ou `/integracao`. Pós-cadastro: `/integracao`.

Nome sugerido no cadastro: parte local do e-mail (`tiago.silva@gmail.com` → `tiago.silva`).

## Painel autenticado

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

## ORPC — fluxo de autenticação

| Procedimento | Uso |
|--------------|-----|
| `autenticacao.iniciarFluxo` | E-mail → hash + tipo + redirect |
| `autenticacao.obterFluxo` | Estado do fluxo (e-mail mascarado, bloqueio, etc.) |
| `autenticacao.enviarOtpFluxo` | Envia OTP (login auto; cadastro no "Criar conta") |
| `autenticacao.entrarFluxo` | Login com hash + OTP |
| `autenticacao.cadastrarFluxo` | Cadastro com hash + OTP + LGPD |

Tabela `fluxo_autenticacao` (migration pelo desenvolvedor).
