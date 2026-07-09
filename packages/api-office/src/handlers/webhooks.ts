import { and, count, desc, eq, ilike, isNull, or, type SQL } from "drizzle-orm";
import { getEvolutionCredentials, notFound, criarClienteEvolutionGo } from "@whasap/api-core";
import {
  colunasInstanciaOperacao,
  instancia,
  webhookEvento,
  type Db,
} from "@whasap/db";
import {
  parseGoConnectionState,
  parseGoQrResponse,
  type EvolutionGoStatusResponse,
  type EvolutionQrResponse,
} from "@whasap/evolution";

import { normalizarPaginacao } from "../lib/listagem";
import type { OfficeContext } from "../types";
import { exigirAutenticacaoOffice } from "./auth-session";

type WebhookPayloadPreview = {
  event?: string;
  instance?: string;
  instanceId?: string;
};

function extrairPreviewWebhook(payload: string): {
  evento: string | null;
  instanciaRef: string | null;
} {
  try {
    const parsed = JSON.parse(payload) as WebhookPayloadPreview;
    return {
      evento: parsed.event ?? null,
      instanciaRef: parsed.instance ?? parsed.instanceId ?? null,
    };
  } catch {
    return { evento: null, instanciaRef: null };
  }
}

async function buscarInstanciaOperacao(db: Db, instanciaUuid: string) {
  return db.query.instancia.findFirst({
    where: and(eq(instancia.uuid, instanciaUuid), isNull(instancia.excluidoEm)),
    columns: colunasInstanciaOperacao,
  });
}

function filtroPayloadInstancia(terms: string[]): SQL | undefined {
  const valid = terms.filter(Boolean);
  if (valid.length === 0) return undefined;
  return or(...valid.map((term) => ilike(webhookEvento.payload, `%${term}%`)));
}

export const webhooksHandlers = {
  /** Lista eventos de webhook persistidos (Postgres). */
  lista: async (
    ctx: OfficeContext,
    input?: {
      limite?: number;
      offset?: number;
      origem?: "evo" | "cloud" | "asaas";
      instanciaId?: string;
    },
  ) => {
    exigirAutenticacaoOffice(ctx);
    const paginacao = normalizarPaginacao(input);

    const filtros: SQL[] = [];
    if (input?.origem) filtros.push(eq(webhookEvento.origem, input.origem));

    if (input?.instanciaId) {
      const row = await buscarInstanciaOperacao(ctx.db, input.instanciaId);
      if (!row) notFound();
      const payloadFilter = filtroPayloadInstancia([
        row.evolucaoNomeInstancia ?? "",
        row.evolucaoInstanceId ?? "",
        row.uuid,
      ]);
      if (payloadFilter) filtros.push(payloadFilter);
    }

    const where = filtros.length > 0 ? and(...filtros) : undefined;

    const [rows, totalRow] = await Promise.all([
      ctx.db.query.webhookEvento.findMany({
        where,
        orderBy: [desc(webhookEvento.criadoEm)],
        limit: paginacao.limite,
        offset: paginacao.offset,
        columns: {
          id: true,
          origem: true,
          idEvento: true,
          payload: true,
          processadoEm: true,
          criadoEm: true,
        },
      }),
      ctx.db.select({ value: count() }).from(webhookEvento).where(where),
    ]);

    return {
      itens: rows.map((row) => {
        const preview = extrairPreviewWebhook(row.payload);
        return {
          id: row.id,
          origem: row.origem,
          idEvento: row.idEvento,
          evento: preview.evento,
          instanciaRef: preview.instanciaRef,
          processadoEm: row.processadoEm?.toISOString() ?? null,
          criadoEm: row.criadoEm.toISOString(),
        };
      }),
      total: totalRow[0]?.value ?? 0,
    };
  },

  /** Retorna payload completo e, se disponível, cópia do R2 (`idEvento` = chave). */
  obter: async (ctx: OfficeContext, input: { id: number }) => {
    exigirAutenticacaoOffice(ctx);

    const row = await ctx.db.query.webhookEvento.findFirst({
      where: eq(webhookEvento.id, input.id),
      columns: {
        id: true,
        origem: true,
        idEvento: true,
        payload: true,
        processadoEm: true,
        criadoEm: true,
      },
    });
    if (!row) notFound();

    let payload: unknown;
    try {
      payload = JSON.parse(row.payload);
    } catch {
      payload = row.payload;
    }

    let r2Conteudo: unknown = null;
    if (row.idEvento) {
      const object = await ctx.env.R2.get(row.idEvento);
      if (object) {
        try {
          r2Conteudo = JSON.parse(await object.text());
        } catch {
          r2Conteudo = await object.text();
        }
      }
    }

    return {
      id: row.id,
      origem: row.origem,
      idEvento: row.idEvento,
      payload,
      processadoEm: row.processadoEm?.toISOString() ?? null,
      criadoEm: row.criadoEm.toISOString(),
      r2Conteudo,
    };
  },
};

export const evolutionDebugHandlers = {
  /** Compara status no banco com respostas ao vivo da Evolution GO. */
  estadoEvolution: async (ctx: OfficeContext, input: { instanciaId: string }) => {
    exigirAutenticacaoOffice(ctx);

    const row = await buscarInstanciaOperacao(ctx.db, input.instanciaId);
    if (!row) notFound();

    const instanciaDb = {
      uuid: row.uuid,
      nome: row.nome,
      status: row.status,
      evolucaoNomeInstancia: row.evolucaoNomeInstancia,
      evolucaoInstanceId: row.evolucaoInstanceId,
      conectadoEm: row.conectadoEm?.toISOString() ?? null,
    };

    if (!row.evolucaoToken) {
      return {
        instanciaDb,
        evolution: {
          statusBruto: null,
          qrBruto: null,
          estado: null,
          erro: "Instância sem evolucaoToken (não provisionada)",
        },
      };
    }

    try {
      const creds = await getEvolutionCredentials(ctx.env);
      const client = criarClienteEvolutionGo(
        ctx.env,
        creds,
        { instanceToken: row.evolucaoToken },
        {
          instanciaUuid: row.uuid,
          ...(row.evolucaoInstanceId ? { evolutionInstanceId: row.evolucaoInstanceId } : {}),
          origem: "office",
          rpc: "administracao.instancias.estadoEvolution",
          dbStatus: row.status,
        },
      );

      let statusBruto: EvolutionGoStatusResponse | null = null;
      let qrBruto: EvolutionQrResponse | null = null;
      let estado: string | null = null;
      let qrErro: string | undefined;

      try {
        statusBruto = await client.getStatus();
        estado = parseGoConnectionState(statusBruto);
      } catch (err) {
        return {
          instanciaDb,
          evolution: {
            statusBruto: null,
            qrBruto: null,
            estado: null,
            erro: err instanceof Error ? err.message : String(err),
          },
        };
      }

      try {
        qrBruto = await client.getQrCode();
        parseGoQrResponse(qrBruto);
      } catch (err) {
        qrErro = err instanceof Error ? err.message : String(err);
      }

      return {
        instanciaDb,
        evolution: {
          statusBruto,
          qrBruto,
          estado,
          erro: qrErro ?? null,
        },
      };
    } catch (err) {
      return {
        instanciaDb,
        evolution: {
          statusBruto: null,
          qrBruto: null,
          estado: null,
          erro: err instanceof Error ? err.message : String(err),
        },
      };
    }
  },
};
