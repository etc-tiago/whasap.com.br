import { varrerInstanciasEvolutionAbandonadas } from "@whasap/api-core";
import { criarDb } from "@whasap/db";
import { garantirWorkersLogger } from "@whasap/evlog/workers";

import type { Env } from "./env";

async function executarVarredura(env: Env): Promise<void> {
  garantirWorkersLogger("evolutionCleanup");
  const { db, sql } = criarDb(env.HYPERDRIVE.connectionString);
  try {
    const resultado = await varrerInstanciasEvolutionAbandonadas(db, env);
    console.info("[whasap-evolution-cleanup] varredura abandonadas", resultado);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

export default {
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(executarVarredura(env));
  },
};
