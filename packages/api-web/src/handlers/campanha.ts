import { badRequest, forbidden, notFound, preconditionFailed } from "@whasap/api-core";
import {
  campanhaEnvio,
  campanhaTemplateMemorizado,
  colunasCampanhaEnvio,
  colunasCampanhaTemplateMemorizado,
  colunasIdUuid,
  colunasOrganizacaoPublica,
  comCriadoEm,
  comTimestampsCriacao,
  instancia,
  marcarExclusaoLogica,
  mensagemTemplate,
  organizacao,
} from "@whasap/db";
import { and, count, desc, eq, gte, isNull, lte } from "drizzle-orm";

import { pode } from "../lib/permissoes";
import type { MemberRole, WebContext } from "../types";
import { exigirAdmin, exigirAutenticacao, resolverMembro } from "./auth";
import { caixaEntradaHandlers } from "./inbox";

const JANELA_ALERTA_MS = 2 * 60 * 1000;

type OrgCampanha = {
  id: number;
  campanhaHabilitada: boolean;
  campanhaLimitePorMinuto: number;
  campanhaLimitePorHora: number;
  campanhaAlertaConsecutivos: number;
};

/**
 * Carrega org e exige módulo de campanha habilitado + membership.
 * @returns organização com flags/limites de campanha e papel do membro
 */
async function exigirCampanhaHabilitada(ctx: WebContext, organizacaoHash: string) {
  const { role } = await resolverMembro(ctx, organizacaoHash);
  const org = await ctx.db.query.organizacao.findFirst({
    where: and(eq(organizacao.uuid, organizacaoHash), isNull(organizacao.excluidoEm)),
    columns: colunasOrganizacaoPublica,
  });
  if (!org) notFound();
  if (!org.campanhaHabilitada) {
    preconditionFailed("Módulo de campanha desativado para esta organização");
  }
  return {
    role,
    org: org as OrgCampanha,
  };
}

function verificarPodeEnviar(role: MemberRole) {
  if (!pode(role, "inbox.enviar")) forbidden();
}

function mapearVariaveis(valor: unknown): Record<string, string> | null {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

async function contarEnviosDesde(
  ctx: WebContext,
  organizacaoId: number,
  desde: Date,
): Promise<number> {
  const [row] = await ctx.db
    .select({ n: count() })
    .from(campanhaEnvio)
    .where(
      and(
        eq(campanhaEnvio.organizacaoId, organizacaoId),
        isNull(campanhaEnvio.excluidoEm),
        gte(campanhaEnvio.criadoEm, desde),
      ),
    );
  return row?.n ?? 0;
}

/**
 * Handlers do módulo de campanha (envio imediato, histórico, templates memorizados).
 */
export const campanhaHandlers = {
  /** Dispara envio imediato e registra em `campanha_envio`. Soft-block por limites da org. */
  enviar: async (
    ctx: WebContext,
    input: {
      organizacaoHash: string;
      instanciaId: string;
      nome?: string;
      telefone: string;
      corpo?: string;
      templateId?: string;
      variaveis?: Record<string, string>;
      confirmarAlertaVolume?: boolean;
      memorizarTemplate?: { nome: string };
    },
  ) => {
    exigirAutenticacao(ctx);
    const { role, org } = await exigirCampanhaHabilitada(ctx, input.organizacaoHash);
    verificarPodeEnviar(role);

    const telefone = input.telefone.replace(/\D/g, "");
    if (telefone.length < 8) badRequest("Telefone inválido");

    const agora = new Date();
    const [contagemMinuto, contagemHora, contagemAlerta] = await Promise.all([
      contarEnviosDesde(ctx, org.id, new Date(agora.getTime() - 60_000)),
      contarEnviosDesde(ctx, org.id, new Date(agora.getTime() - 3_600_000)),
      contarEnviosDesde(ctx, org.id, new Date(agora.getTime() - JANELA_ALERTA_MS)),
    ]);

    if (org.campanhaLimitePorMinuto > 0 && contagemMinuto >= org.campanhaLimitePorMinuto) {
      preconditionFailed(
        `Limite de ${org.campanhaLimitePorMinuto} envios por minuto atingido. Aguarde ou ajuste em Ajustes → Campanha.`,
      );
    }
    if (org.campanhaLimitePorHora > 0 && contagemHora >= org.campanhaLimitePorHora) {
      preconditionFailed(
        `Limite de ${org.campanhaLimitePorHora} envios por hora atingido. Aguarde ou ajuste em Ajustes → Campanha.`,
      );
    }

    const instanciaRow = await ctx.db.query.instancia.findFirst({
      where: and(
        eq(instancia.uuid, input.instanciaId),
        eq(instancia.organizacaoId, org.id),
        isNull(instancia.excluidoEm),
      ),
      columns: colunasIdUuid,
    });
    if (!instanciaRow) notFound("Instância não encontrada");

    let templateNome: string | null = null;
    let templateIdioma: string | null = null;
    if (input.templateId) {
      const tpl = await ctx.db.query.mensagemTemplate.findFirst({
        where: and(
          eq(mensagemTemplate.uuid, input.templateId),
          isNull(mensagemTemplate.excluidoEm),
        ),
        columns: { nome: true, idioma: true },
      });
      if (!tpl) notFound("Template não encontrado");
      templateNome = tpl.nome;
      templateIdioma = tpl.idioma;
    }

    let conversaId: string | null = null;
    let status: "enviado" | "erro" = "enviado";
    let erroMensagem: string | null = null;

    try {
      const result = await caixaEntradaHandlers.conversas.iniciar(ctx, {
        instanciaId: input.instanciaId,
        telefone,
        nome: input.nome,
        corpo: input.corpo,
        templateId: input.templateId,
        variaveis: input.variaveis,
      });
      conversaId = result.conversaId;
    } catch (err) {
      status = "erro";
      erroMensagem = err instanceof Error ? err.message : "Falha ao enviar";
      await ctx.db.insert(campanhaEnvio).values(
        comCriadoEm({
          organizacaoId: org.id,
          instanciaId: instanciaRow.id,
          usuarioId: ctx.usuario!.internalId,
          nomeDestinatario: input.nome ?? null,
          telefone,
          corpo: input.corpo ?? templateNome,
          templateNome,
          templateIdioma,
          templateVariaveis: input.variaveis ?? null,
          status,
          erroMensagem,
          conversaUuid: null,
        }),
      );
      throw err;
    }

    const [envio] = await ctx.db
      .insert(campanhaEnvio)
      .values(
        comCriadoEm({
          organizacaoId: org.id,
          instanciaId: instanciaRow.id,
          usuarioId: ctx.usuario!.internalId,
          nomeDestinatario: input.nome ?? null,
          telefone,
          corpo: input.corpo ?? templateNome,
          templateNome,
          templateIdioma,
          templateVariaveis: input.variaveis ?? null,
          status,
          erroMensagem,
          conversaUuid: conversaId,
        }),
      )
      .returning({ uuid: campanhaEnvio.uuid });

    if (input.memorizarTemplate && templateNome && templateIdioma) {
      await ctx.db.insert(campanhaTemplateMemorizado).values(
        comTimestampsCriacao({
          organizacaoId: org.id,
          instanciaId: instanciaRow.id,
          nome: input.memorizarTemplate.nome,
          templateNome,
          templateIdioma,
          variaveis: input.variaveis ?? null,
        }),
      );
    }

    const contagemRecente = contagemAlerta + 1;
    const alertaVolume = contagemRecente >= org.campanhaAlertaConsecutivos;

    return {
      conversaId: conversaId!,
      envioId: envio!.uuid,
      alertaVolume,
      contagemRecente,
    };
  },

  /** Lista paginada de envios da org para relatório/histórico. */
  listaEnvios: async (
    ctx: WebContext,
    input: {
      organizacaoHash: string;
      pagina: number;
      porPagina: number;
      status?: "enviado" | "erro";
      instanciaId?: string;
      de?: string;
      ate?: string;
    },
  ) => {
    exigirAutenticacao(ctx);
    const { org } = await exigirCampanhaHabilitada(ctx, input.organizacaoHash);

    let instanciaInternaId: number | undefined;
    if (input.instanciaId) {
      const inst = await ctx.db.query.instancia.findFirst({
        where: and(
          eq(instancia.uuid, input.instanciaId),
          eq(instancia.organizacaoId, org.id),
          isNull(instancia.excluidoEm),
        ),
        columns: colunasIdUuid,
      });
      if (!inst) notFound("Instância não encontrada");
      instanciaInternaId = inst.id;
    }

    const condicoes = [eq(campanhaEnvio.organizacaoId, org.id), isNull(campanhaEnvio.excluidoEm)];
    if (input.status) condicoes.push(eq(campanhaEnvio.status, input.status));
    if (instanciaInternaId !== undefined) {
      condicoes.push(eq(campanhaEnvio.instanciaId, instanciaInternaId));
    }
    if (input.de) condicoes.push(gte(campanhaEnvio.criadoEm, new Date(input.de)));
    if (input.ate) condicoes.push(lte(campanhaEnvio.criadoEm, new Date(input.ate)));

    const where = and(...condicoes);
    const offset = (input.pagina - 1) * input.porPagina;

    const [totalRow, rows] = await Promise.all([
      ctx.db.select({ n: count() }).from(campanhaEnvio).where(where),
      ctx.db.query.campanhaEnvio.findMany({
        where,
        columns: colunasCampanhaEnvio,
        with: {
          instancia: { columns: { uuid: true } },
          usuario: { columns: { uuid: true } },
        },
        orderBy: [desc(campanhaEnvio.criadoEm)],
        limit: input.porPagina,
        offset,
      }),
    ]);

    return {
      total: totalRow[0]?.n ?? 0,
      itens: rows.map((r) => ({
        id: r.uuid,
        instanciaId: r.instancia.uuid,
        usuarioId: r.usuario.uuid,
        nomeDestinatario: r.nomeDestinatario,
        telefone: r.telefone,
        corpo: r.corpo,
        templateNome: r.templateNome,
        templateIdioma: r.templateIdioma,
        templateVariaveis: mapearVariaveis(r.templateVariaveis),
        status: r.status as "enviado" | "erro",
        erroMensagem: r.erroMensagem,
        conversaId: r.conversaUuid,
        criadoEm: r.criadoEm.toISOString(),
      })),
    };
  },

  /** Contagens do dia e da última hora para o painel de campanha. */
  resumo: async (ctx: WebContext, input: { organizacaoHash: string }) => {
    exigirAutenticacao(ctx);
    const { org } = await exigirCampanhaHabilitada(ctx, input.organizacaoHash);

    const agora = new Date();
    const inicioDia = new Date(agora);
    inicioDia.setHours(0, 0, 0, 0);
    const inicioHora = new Date(agora.getTime() - 3_600_000);

    const baseHoje = and(
      eq(campanhaEnvio.organizacaoId, org.id),
      isNull(campanhaEnvio.excluidoEm),
      gte(campanhaEnvio.criadoEm, inicioDia),
    );

    const [[totalHoje], [enviadosHoje], [errosHoje], [enviadosHora]] = await Promise.all([
      ctx.db.select({ n: count() }).from(campanhaEnvio).where(baseHoje),
      ctx.db
        .select({ n: count() })
        .from(campanhaEnvio)
        .where(and(baseHoje, eq(campanhaEnvio.status, "enviado"))),
      ctx.db
        .select({ n: count() })
        .from(campanhaEnvio)
        .where(and(baseHoje, eq(campanhaEnvio.status, "erro"))),
      ctx.db
        .select({ n: count() })
        .from(campanhaEnvio)
        .where(
          and(
            eq(campanhaEnvio.organizacaoId, org.id),
            isNull(campanhaEnvio.excluidoEm),
            gte(campanhaEnvio.criadoEm, inicioHora),
            eq(campanhaEnvio.status, "enviado"),
          ),
        ),
    ]);

    return {
      totalHoje: totalHoje?.n ?? 0,
      enviadosHoje: enviadosHoje?.n ?? 0,
      errosHoje: errosHoje?.n ?? 0,
      enviadosHora: enviadosHora?.n ?? 0,
    };
  },

  templatesMemorizados: {
    lista: async (ctx: WebContext, input: { organizacaoHash: string; instanciaId?: string }) => {
      exigirAutenticacao(ctx);
      const { org } = await exigirCampanhaHabilitada(ctx, input.organizacaoHash);

      let instanciaInternaId: number | undefined;
      if (input.instanciaId) {
        const inst = await ctx.db.query.instancia.findFirst({
          where: and(
            eq(instancia.uuid, input.instanciaId),
            eq(instancia.organizacaoId, org.id),
            isNull(instancia.excluidoEm),
          ),
          columns: colunasIdUuid,
        });
        if (!inst) notFound("Instância não encontrada");
        instanciaInternaId = inst.id;
      }

      const rows = await ctx.db.query.campanhaTemplateMemorizado.findMany({
        where: and(
          eq(campanhaTemplateMemorizado.organizacaoId, org.id),
          isNull(campanhaTemplateMemorizado.excluidoEm),
          instanciaInternaId !== undefined
            ? eq(campanhaTemplateMemorizado.instanciaId, instanciaInternaId)
            : undefined,
        ),
        columns: colunasCampanhaTemplateMemorizado,
        with: { instancia: { columns: { uuid: true } } },
        orderBy: [desc(campanhaTemplateMemorizado.atualizadoEm)],
      });

      return rows.map((r) => ({
        id: r.uuid,
        instanciaId: r.instancia?.uuid ?? null,
        nome: r.nome,
        templateNome: r.templateNome,
        templateIdioma: r.templateIdioma,
        variaveis: mapearVariaveis(r.variaveis),
        criadoEm: r.criadoEm.toISOString(),
        atualizadoEm: r.atualizadoEm.toISOString(),
      }));
    },

    salvar: async (
      ctx: WebContext,
      input: {
        organizacaoHash: string;
        instanciaId?: string;
        nome: string;
        templateNome: string;
        templateIdioma: string;
        variaveis?: Record<string, string>;
      },
    ) => {
      exigirAutenticacao(ctx);
      const { role, org } = await exigirCampanhaHabilitada(ctx, input.organizacaoHash);
      verificarPodeEnviar(role);

      let instanciaInternaId: number | null = null;
      if (input.instanciaId) {
        const inst = await ctx.db.query.instancia.findFirst({
          where: and(
            eq(instancia.uuid, input.instanciaId),
            eq(instancia.organizacaoId, org.id),
            isNull(instancia.excluidoEm),
          ),
          columns: colunasIdUuid,
        });
        if (!inst) notFound("Instância não encontrada");
        instanciaInternaId = inst.id;
      }

      const [row] = await ctx.db
        .insert(campanhaTemplateMemorizado)
        .values(
          comTimestampsCriacao({
            organizacaoId: org.id,
            instanciaId: instanciaInternaId,
            nome: input.nome.trim(),
            templateNome: input.templateNome,
            templateIdioma: input.templateIdioma,
            variaveis: input.variaveis ?? null,
          }),
        )
        .returning();

      return {
        id: row!.uuid,
        instanciaId: input.instanciaId ?? null,
        nome: row!.nome,
        templateNome: row!.templateNome,
        templateIdioma: row!.templateIdioma,
        variaveis: mapearVariaveis(row!.variaveis),
        criadoEm: row!.criadoEm.toISOString(),
        atualizadoEm: row!.atualizadoEm.toISOString(),
      };
    },

    remover: async (ctx: WebContext, input: { organizacaoHash: string; id: string }) => {
      exigirAutenticacao(ctx);
      await exigirAdmin(ctx, input.organizacaoHash);
      const { org } = await exigirCampanhaHabilitada(ctx, input.organizacaoHash);

      const row = await ctx.db.query.campanhaTemplateMemorizado.findFirst({
        where: and(
          eq(campanhaTemplateMemorizado.uuid, input.id),
          eq(campanhaTemplateMemorizado.organizacaoId, org.id),
          isNull(campanhaTemplateMemorizado.excluidoEm),
        ),
        columns: { id: true },
      });
      if (!row) notFound();

      await ctx.db
        .update(campanhaTemplateMemorizado)
        .set(marcarExclusaoLogica())
        .where(eq(campanhaTemplateMemorizado.id, row.id));

      return { ok: true };
    },
  },
};
