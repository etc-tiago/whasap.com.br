/**
 * Cliente ORPC do painel web (`webContract`).
 * - Browser: `/rpc` na mesma origem com cookie JWT de sessão (`credentials: "include"`).
 * - SSR: aponta para `localhost:3000/rpc`.
 * Use `orpc` para TanStack Query; `orpcClient` para chamadas imperativas.
 */
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { ContractRouterClient } from "@orpc/contract";
import type { webContract } from "@whasap/orpc/web";

function getRpcBaseUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/rpc`;
  }
  return "http://localhost:3000/rpc";
}

const link = new RPCLink({
  url: getRpcBaseUrl,
  fetch: (request, init) =>
    fetch(request, {
      ...init,
      credentials: "include",
    }),
});

export const orpcClient = createORPCClient<ContractRouterClient<typeof webContract>>(link);
export const orpc = createTanstackQueryUtils(orpcClient);

export type InstanciaItem = Awaited<ReturnType<typeof orpcClient.instancia.lista>>[number];

export type ConversaItem = Awaited<
  ReturnType<typeof orpcClient.caixaEntrada.conversas.lista>
>[number];

export type MensagemItem = Awaited<
  ReturnType<typeof orpcClient.caixaEntrada.mensagens.lista>
>[number];

export type RelatorioVisaoGeral = Awaited<ReturnType<typeof orpcClient.relatorios.visaoGeral>>;
