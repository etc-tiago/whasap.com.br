/** Ponte server-side: delega `/rpc` para `@whasap/api-office` com env Cloudflare. */
import { handleRpc, type OfficeEnv } from "@whasap/api-office";
import { env } from "cloudflare:workers";

export async function handleRpcRequest(request: Request): Promise<Response> {
  return handleRpc(request, env as OfficeEnv);
}
