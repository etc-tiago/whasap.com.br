import { createFileRoute } from "@tanstack/react-router";
import { log } from "@whasap/evlog";
import { env } from "cloudflare:workers";

import type { OrcamentoRegistro } from "@/lib/orcamento";

function validarPayload(body: unknown): OrcamentoRegistro | null {
  if (!body || typeof body !== "object") return null;
  const p = body as Record<string, unknown>;
  if (typeof p.id !== "string" || !p.id) return null;
  if (typeof p.numerosWhatsapp !== "number" || p.numerosWhatsapp < 1) return null;
  if (typeof p.atendentes !== "number" || p.atendentes < 1) return null;
  if (typeof p.faixaContatos !== "string") return null;
  if (typeof p.planoId !== "string") return null;
  if (typeof p.totalCents !== "number") return null;
  return body as OrcamentoRegistro;
}

export const Route = createFileRoute("/api/orcamento")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        log.info({ api: "orcamento" });
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ ok: false, erro: "JSON inválido" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const payload = validarPayload(body);
        if (!payload) {
          return new Response(JSON.stringify({ ok: false, erro: "Payload inválido" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const registro: OrcamentoRegistro = {
          ...payload,
          criadoEm: payload.criadoEm ?? new Date().toISOString(),
        };

        const date = registro.criadoEm.slice(0, 10);
        const sufixo = registro.trilha ? `-${registro.trilha}` : "";
        const key = `leads/orcamento/${date}/${registro.id}${sufixo}.json`;

        try {
          if (env.R2) {
            await env.R2.put(key, JSON.stringify(registro), {
              httpMetadata: { contentType: "application/json" },
            });
            log.info({ orcamento: { id: registro.id, r2Key: key, persistido: true } });
          } else {
            log.info({ orcamento: { id: registro.id, devSemR2: true } });
          }
        } catch (err) {
          log.error({
            orcamento: { persistenciaFalhou: true, id: registro.id },
            erro: err instanceof Error ? err.message : String(err),
          });
        }

        return new Response(JSON.stringify({ ok: true, id: registro.id }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
