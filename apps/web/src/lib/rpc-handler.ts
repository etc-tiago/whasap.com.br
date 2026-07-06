import { handleRpc, type WebEnv } from "@whasap/api-web";
import { env } from "cloudflare:workers";

export async function handleRpcRequest(request: Request): Promise<Response> {
  return handleRpc(request, env as WebEnv);
}
