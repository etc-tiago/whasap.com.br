import {
  fecharConversasInativasGlobal,
  varrerInstanciasEvolutionAbandonadas,
} from "@whasap/api-core";
import { criarDb } from "@whasap/db";
import { garantirWorkersLogger } from "@whasap/evlog/workers";

import type { Env } from "./env";

async function executarVarredura(env: Env): Promise<void> {
  garantirWorkersLogger("evolutionCleanup");
  const { db, sql } = criarDb(env.HYPERDRIVE.connectionString);
  try {
    const [abandonadas, inativas] = await Promise.all([
      varrerInstanciasEvolutionAbandonadas(db, env),
      fecharConversasInativasGlobal(db),
    ]);
    console.info("[whasap-evolution-cleanup] varredura abandonadas", abandonadas);
    console.info("[whasap-evolution-cleanup] auto-fechar inativas", inativas);
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
