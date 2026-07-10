# Fixtures de respostas Evolution GO

Respostas reais capturadas da API, usadas em `src/demo-jsons.test.ts`.

## Estrutura

```
respostas/instance/{acao}/case-{numero}.json
```

| Ação | Endpoint |
|------|----------|
| `create` | `POST /instance/create` |
| `connect` | `POST /instance/connect` |
| `qr` | `GET /instance/qr` |
| `status` | `GET /instance/status` |

## Cases atuais

### `create/`
| Arquivo | Descrição |
|---------|-----------|
| `case-1.json` | sucesso — instância criada |
| `case-2.json` | erro — `instance already exists` |

### `connect/`
| Arquivo | Descrição |
|---------|-----------|
| `case-1.json` | mínimo — só `MESSAGE`, webhook vazio |
| `case-2.json` | webhook completo com todos os eventos |

### `qr/`
| Arquivo | Descrição |
|---------|-----------|
| `case-1.json` | sucesso — `qrcode` + `code` wa.me |
| `case-2.json` | erro — QR indisponível |
| `case-3.json` | erro — sessão já logada |

### `status/`
| Arquivo | Descrição |
|---------|-----------|
| `case-1.json` | desconectado — `Connected`/`LoggedIn` false |
| `case-2.json` | conectado — `Connected`/`LoggedIn` true, com `Name` |

## Adicionar novos cases

1. Criar `instance/{acao}/case-{N}.json` (próximo número sequencial)
2. Documentar na tabela acima
3. Os testes carregam via `carregarFixturesRespostaGo(acao)` e `buscarFixturePorCase(fixtures, N)`
