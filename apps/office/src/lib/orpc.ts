/**
 * Cliente ORPC do painel office (`officeContract`).
 * Porta dev: 3001. Cookies de sessão via `credentials: "include"`.
 */
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { ContractRouterClient } from "@orpc/contract";
import type { officeContract } from "@whasap/orpc/office";

function getRpcBaseUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/rpc`;
  }
  return "http://localhost:3001/rpc";
}

const link = new RPCLink({
  url: getRpcBaseUrl,
  fetch: (request, init) =>
    fetch(request, {
      ...init,
      credentials: "include",
    }),
});

export const orpcClient = createORPCClient<ContractRouterClient<typeof officeContract>>(link);
export const orpc = createTanstackQueryUtils(orpcClient);
