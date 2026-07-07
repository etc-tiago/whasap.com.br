# @whasap/evolution

Cliente HTTP para **Evolution GO** (whatsmeow).

## Documentação oficial da API

A especificação OpenAPI/Swagger oficial está em [`doc-oficial.json`](./doc-oficial.json) neste pacote. Use-a como referência para rotas, bodies e tipos de mensagem (`/send/*`, `/instance/*`, `/message/*`).

Implementação: [`src/client-go.ts`](./src/client-go.ts).

## Auth

- Header `apikey` com a chave global em operações administrativas (`/instance/create`)
- Header `apikey` com o token da instância nas demais chamadas (`/send/*`, `/instance/qr`, etc.)
