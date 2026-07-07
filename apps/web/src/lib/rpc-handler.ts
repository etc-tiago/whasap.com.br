/** Ponte server-side: delega `/rpc` para `@whasap/api-web` com env Cloudflare. */
import { handleRpc, type WebEnv } from "@whasap/api-web";
import { env } from "cloudflare:workers";

export async function handleRpcRequest(request: Request): Promise<Response> {
  return handleRpc(request, env as WebEnv);
}
