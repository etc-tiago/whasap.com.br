import {
  criarClienteMeta,
  forbidden,
  notFound,
  preconditionFailed,
  solicitarHistoricoSyncConversaEvolution,
} from "@whasap/api-core";
import {
  buildOutboundMediaR2Key,
  cdnMediaUrl,
  ICONE_CONEXAO_PADRAO,
  isEvoProvider,
  isIconeConexao,
  isMetaCloudProvider,
  mimeToExtension,
  type IconeConexao,
} from "@whasap/config";
import type { MetaTemplate } from "@whasap/meta";
import { and, asc, count, desc, eq, ilike, inArray, isNull, or, type SQL } from "drizzle-orm";
import {
  contato,
  contatoInstancia,
  contatoTag,
  contatoTagAtribuicao,
  conversa,
  conversaAnotacao,
  colunasContatoCaixaEntrada,
  colunasContatoInstancia,
  colunasContatoTag,
  colunasConversaAnotacao,
  colunasConversaComRelacoes,
  colunasConversaLista,
  colunasInstanciaOperacao,
  colunasMensagemLista,
  colunasMensagemTemplate,
  colunasSomenteId,
  comCriadoEm,
  comTimestampsCriacao,
  comTimestampAtualizacao,
  incluirContatoCaixaEntrada,
  incluirInstanciaOperacao,
  incluirUsuarioRelacao,
  instancia,
  marcarExclusaoLogica,
  mensagem,
  mensagemTemplate,
  resolverIdInterno,
} from "@whasap/db";

import { obterCredenciaisMeta } from "./instancia";
import {
  assertMessageTypeSupported,
  cloudRequiresTemplate,
  isMetaCloudWindowOpen,
  markProviderMessageRead,
  sendProviderMessage,
} from "../lib/messaging";
import type { InstanciaComProvedor } from "../lib/instancia-provedor";
import type { WebContext } from "../types";
import { exigirAutenticacao, resolverMembro, resolverMembroPorIdInterno } from "./auth";
import {
  atribuirEtiquetaEvolution,
  criarEtiquetaEvolution,
  garantirEtiquetaEvolution,
  removerEtiquetaEvolution,
} from "../lib/evolution-etiquetas";
import { isInstanceOperational } from "../lib/instance-operational";
import { garantirMidiasDaConversa } from "../lib/garantir-midia-conversa";
import type { MemberRole } from "../types";

function base64ParaArrayBuffer(base64: string): ArrayBuffer {
  const normalized = base64.replace(/^data:[^;]+;base64,/, "");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

const LIMITE_MIDIA_BYTES = 20 * 1024 * 1024;

function mimeCompativelComTipo(tipo: string, tipoConteudo: string): boolean {
  const mime = tipoConteudo.split(";")[0]?.trim().toLowerCase() ?? "";
  if (tipo === "image") return mime.startsWith("image/");
  if (tipo === "audio") return mime.startsWith("audio/");
  if (tipo === "video") return mime.startsWith("video/");
  if (tipo === "document") {
    return mime.startsWith("application/") || mime.startsWith("text/");
  }
  return false;
}

function resolverUrlMidia(
  ctx: WebContext,
  mediaUrl?: string,
  mediaR2Key?: string,
): string | undefined {
  if (mediaUrl) return mediaUrl;
  if (mediaR2Key && ctx.env.CDN_URL) return cdnMediaUrl(ctx.env.CDN_URL, mediaR2Key);
  return undefined;
}

/**
 * Busca conversa ativa com instância e contato relacionados.
 * @returns `null` se não encontrada ou instância ausente.
 */
async function buscarConversaPorUuid(ctx: WebContext, conversaUuid: string) {
  const conversation = await ctx.db.query.conversa.findFirst({
    where: and(eq(conversa.uuid, conversaUuid), isNull(conversa.excluidoEm)),
    columns: colunasConversaComRelacoes,
    with: {
      instancia: incluirInstanciaOperacao,
      contato: incluirContatoCaixaEntrada,
    },
  });
  if (!conversation?.instancia) return null;
  return { conversation, instance: conversation.instancia, contact: conversation.contato };
}

/**
 * Exige que o usuário seja membro da org da conversa.
 * @throws 404 se a conversa não existir.
 */
async function exigirAcessoConversa(ctx: WebContext, conversaUuid: string) {
  const conv = await buscarConversaPorUuid(ctx, conversaUuid);
  if (!conv) notFound();
  const { role } = await resolverMembroPorIdInterno(ctx, conv.instance.organizacaoId);
  return { ...conv, role };
}

async function exigirAcessoContato(ctx: WebContext, contatoUuid: string) {
  const contact = await ctx.db.query.contato.findFirst({
    where: and(eq(contato.uuid, contatoUuid), isNull(contato.excluidoEm)),
    columns: colunasContatoCaixaEntrada,
  });
  if (!contact) notFound();
  const { role } = await resolverMembroPorIdInterno(ctx, contact.organizacaoId);
  return { contact, role, organizacaoId: contact.organizacaoId };
}

async function resolverInstanciaEvoDoContato(
  ctx: WebContext,
  contactId: number,
): Promise<InstanciaComProvedor | null> {
  const vinculos = await ctx.db.query.contatoInstancia.findMany({
    where: eq(contatoInstancia.contatoId, contactId),
    columns: colunasContatoInstancia,
  });
  const rows = await Promise.all(
    vinculos.map((vinculo) =>
      ctx.db.query.instancia.findFirst({
        where: and(eq(instancia.id, vinculo.instanciaId), isNull(instancia.excluidoEm)),
        columns: colunasInstanciaOperacao,
        with: {
          evo: incluirInstanciaOperacao.with.evo,
          metaCloud: incluirInstanciaOperacao.with.metaCloud,
        },
      }),
    ),
  );
  return (
    rows.find((row) => row && isEvoProvider(row.provedor) && isInstanceOperational(row)) ?? null
  );
}

async function resolverIdExternoLinhaContato(
  ctx: WebContext,
  contactId: number,
  instanciaId: number,
): Promise<string | null> {
  const vinculo = await ctx.db.query.contatoInstancia.findFirst({
    where: and(
      eq(contatoInstancia.contatoId, contactId),
      eq(contatoInstancia.instanciaId, instanciaId),
    ),
    columns: colunasContatoInstancia,
  });
  return vinculo?.idExterno ?? null;
}

/** Exige que o usuário seja membro da org dona da instância. */
async function exigirAcessoInstancia(ctx: WebContext, instanciaUuid: string) {
  const instance = await ctx.db.query.instancia.findFirst({
    where: and(eq(instancia.uuid, instanciaUuid), isNull(instancia.excluidoEm)),
    columns: colunasInstanciaOperacao,
    with: {
      evo: incluirInstanciaOperacao.with.evo,
      metaCloud: incluirInstanciaOperacao.with.metaCloud,
    },
  });
  if (!instance) notFound();
  const { role } = await resolverMembroPorIdInterno(ctx, instance.organizacaoId);
  return { instance, role };
}

/** Analistas têm acesso somente leitura na caixa de entrada. */
function verificarPodeEscreverCaixaEntrada(role: MemberRole) {
  if (role === "analista") forbidden();
}

/**
 * Normaliza telefone e monta o id externo WhatsApp (`{digits}@s.whatsapp.net`).
 */
function normalizarTelefoneContato(telefone: string) {
  const phone = telefone.replace(/\D/g, "");
  return { phone, idExterno: `${phone}@s.whatsapp.net` };
}

type ContatoListaSaida = {
  id: string;
  nome: string | null;
  telefone: string | null;
  criadoEm: string;
  instancias: Array<{
    id: string;
    nome: string;
    icone: IconeConexao;
  }>;
  conversaAberta: {
    id: string;
    instanciaId: string;
    instanciaNome: string;
    usuarioAtribuidoId: string | null;
    usuarioAtribuidoNome: string | null;
  } | null;
};

/**
 * Monta itens da lista de contatos com instâncias vinculadas e conversa aberta (se houver).
 */
async function montarItensContatoLista(
  ctx: WebContext,
  contacts: Array<{
    id: number;
    uuid: string;
    nome: string | null;
    telefone: string | null;
    criadoEm: Date;
  }>,
): Promise<ContatoListaSaida[]> {
  if (contacts.length === 0) return [];

  const contactIds = contacts.map((c) => c.id);

  const vinculos = await ctx.db.query.contatoInstancia.findMany({
    where: inArray(contatoInstancia.contatoId, contactIds),
    columns: colunasContatoInstancia,
  });

  const instanciaIds = [...new Set(vinculos.map((v) => v.instanciaId))];
  const instanciasRows =
    instanciaIds.length > 0
      ? await ctx.db.query.instancia.findMany({
          where: and(inArray(instancia.id, instanciaIds), isNull(instancia.excluidoEm)),
          columns: { id: true, uuid: true, nome: true, icone: true },
        })
      : [];
  const instanciaPorId = new Map(instanciasRows.map((i) => [i.id, i]));

  const instanciasPorContato = new Map<number, ContatoListaSaida["instancias"]>();
  for (const vinculo of vinculos) {
    const inst = instanciaPorId.get(vinculo.instanciaId);
    if (!inst) continue;
    const lista = instanciasPorContato.get(vinculo.contatoId) ?? [];
    lista.push({
      id: inst.uuid,
      nome: inst.nome,
      icone: isIconeConexao(inst.icone) ? inst.icone : ICONE_CONEXAO_PADRAO,
    });
    instanciasPorContato.set(vinculo.contatoId, lista);
  }

  const conversasAbertas = await ctx.db.query.conversa.findMany({
    where: and(
      inArray(conversa.contatoId, contactIds),
      eq(conversa.status, "open"),
      isNull(conversa.excluidoEm),
    ),
    columns: {
      id: true,
      uuid: true,
      contatoId: true,
      instanciaId: true,
      ultimaMensagemEm: true,
    },
    with: {
      atribuidoUsuario: incluirUsuarioRelacao,
      instancia: { columns: { id: true, uuid: true, nome: true } },
    },
    orderBy: [desc(conversa.ultimaMensagemEm)],
  });

  const conversaAbertaPorContato = new Map<number, (typeof conversasAbertas)[number]>();
  for (const row of conversasAbertas) {
    if (!conversaAbertaPorContato.has(row.contatoId)) {
      conversaAbertaPorContato.set(row.contatoId, row);
    }
  }

  return contacts.map((c) => {
    const aberta = conversaAbertaPorContato.get(c.id);
    return {
      id: c.uuid,
      nome: c.nome,
      telefone: c.telefone,
      criadoEm: c.criadoEm.toISOString(),
      instancias: instanciasPorContato.get(c.id) ?? [],
      conversaAberta: aberta?.instancia
        ? {
            id: aberta.uuid,
            instanciaId: aberta.instancia.uuid,
            instanciaNome: aberta.instancia.nome,
            usuarioAtribuidoId: aberta.atribuidoUsuario?.uuid ?? null,
            usuarioAtribuidoNome: aberta.atribuidoUsuario?.nome ?? null,
          }
        : null,
    };
  });
}

function mapearMensagemParaSaida(
  m: {
    uuid: string;
    idExterno?: string | null;
    direcao: string;
    tipo: string;
    corpo: string | null;
    midiaR2Chave?: string | null;
    status: string;
    templateNome: string | null;
    criadoEm: Date;
    enviadoPorUsuario?: { uuid: string; nome: string } | null;
  },
  cdnUrl?: string,
) {
  return {
    id: m.uuid,
    idExterno: m.idExterno ?? null,
    direction: m.direcao as "inbound" | "outbound",
    type: m.tipo,
    body: m.corpo,
    mediaUrl: m.midiaR2Chave && cdnUrl ? cdnMediaUrl(cdnUrl, m.midiaR2Chave) : null,
    enviadoPorUsuarioId: m.enviadoPorUsuario?.uuid ?? null,
    enviadoPorNome: m.enviadoPorUsuario?.nome ?? null,
    templateNome: m.templateNome,
    statusEntrega: m.status,
    criadoEm: m.criadoEm.toISOString(),
  };
}

async function sincronizarTemplateMeta(
  ctx: WebContext,
  instanciaId: number,
  tpl: MetaTemplate,
): Promise<void> {
  const existing = await ctx.db.query.mensagemTemplate.findFirst({
    where: and(
      eq(mensagemTemplate.instanciaId, instanciaId),
      eq(mensagemTemplate.nome, tpl.name),
      eq(mensagemTemplate.idioma, tpl.language),
      isNull(mensagemTemplate.excluidoEm),
    ),
    columns: colunasSomenteId,
  });
  if (existing) {
    await ctx.db
      .update(mensagemTemplate)
      .set(
        comTimestampAtualizacao({
          categoria: tpl.category,
          status: tpl.status,
          componentes: tpl.components,
          idExterno: tpl.id,
          sincronizadoEm: new Date(),
        }),
      )
      .where(eq(mensagemTemplate.id, existing.id));
    return;
  }

  await ctx.db.insert(mensagemTemplate).values(
    comTimestampsCriacao({
      instanciaId,
      nome: tpl.name,
      idioma: tpl.language,
      categoria: tpl.category,
      status: tpl.status,
      componentes: tpl.components,
      idExterno: tpl.id,
      sincronizadoEm: new Date(),
    }),
  );
}

/**
 * Handlers da caixa de entrada: conversas, mensagens, templates e anotações.
 * Analistas têm acesso somente leitura; admin e usuario podem enviar mensagens.
 */
export const caixaEntradaHandlers = {
  conversas: {
    lista: async (ctx: WebContext, input: { organizacaoHash: string; instanciaId?: string }) => {
      exigirAutenticacao(ctx);
      await resolverMembro(ctx, input.organizacaoHash);
      const organizacaoId = await resolverIdInterno(ctx.db, "organizacao", input.organizacaoHash);
      if (organizacaoId === null) notFound();
      let instances: InstanciaComProvedor[];
      if (input.instanciaId) {
        const { instance } = await exigirAcessoInstancia(ctx, input.instanciaId);
        if (instance.organizacaoId !== organizacaoId) notFound();
        instances = [instance];
      } else {
        instances = await ctx.db.query.instancia.findMany({
          where: and(eq(instancia.organizacaoId, organizacaoId), isNull(instancia.excluidoEm)),
          columns: colunasInstanciaOperacao,
        });
      }

      if (instances.length === 0) return [];

      const instanceById = new Map(instances.map((i) => [i.id, i]));
      const instanceIds = instances.map((i) => i.id);

      const rows = await ctx.db.query.conversa.findMany({
        where: and(inArray(conversa.instanciaId, instanceIds), isNull(conversa.excluidoEm)),
        columns: colunasConversaLista,
        with: {
          contato: incluirContatoCaixaEntrada,
          atribuidoUsuario: incluirUsuarioRelacao,
        },
        orderBy: [desc(conversa.ultimaMensagemEm)],
      });

      let rowsWithContato = rows.filter((row) => row.contato);

      if (!input.instanciaId) {
        const byContato = new Map<number, (typeof rows)[number]>();
        for (const row of rowsWithContato) {
          const existing = byContato.get(row.contatoId);
          if (!existing) {
            byContato.set(row.contatoId, row);
            continue;
          }
          const existingTime = existing.ultimaMensagemEm?.getTime() ?? 0;
          const rowTime = row.ultimaMensagemEm?.getTime() ?? 0;
          if (rowTime > existingTime) byContato.set(row.contatoId, row);
        }
        rowsWithContato = [...byContato.values()].toSorted(
          (a, b) => (b.ultimaMensagemEm?.getTime() ?? 0) - (a.ultimaMensagemEm?.getTime() ?? 0),
        );
      }

      const contatoIds = rowsWithContato.map((row) => row.contato!.id);

      const atribuicoes =
        contatoIds.length > 0
          ? await ctx.db.query.contatoTagAtribuicao.findMany({
              where: inArray(contatoTagAtribuicao.contatoId, contatoIds),
              with: { tag: { columns: colunasContatoTag } },
            })
          : [];

      const etiquetasPorContato = new Map<
        string,
        Array<{ id: string; nome: string; cor: string | null }>
      >();
      for (const atrib of atribuicoes) {
        if (!atrib.tag) continue;
        const lista = etiquetasPorContato.get(String(atrib.contatoId)) ?? [];
        lista.push({
          id: atrib.tag.uuid,
          nome: atrib.tag.nome,
          cor: atrib.tag.cor,
        });
        etiquetasPorContato.set(String(atrib.contatoId), lista);
      }

      return Promise.all(
        rowsWithContato.map(async (row) => {
          const contatoRow = row.contato!;
          const inst = instanceById.get(row.instanciaId)!;
          const lastMsg = await ctx.db.query.mensagem.findFirst({
            where: and(eq(mensagem.conversaId, row.id), isNull(mensagem.excluidoEm)),
            columns: { corpo: true, tipo: true },
            orderBy: [desc(mensagem.criadoEm)],
          });
          return {
            id: row.uuid,
            instanciaId: inst.uuid,
            instanciaNome: inst.nome,
            instanciaIcone: isIconeConexao(inst.icone) ? inst.icone : ICONE_CONEXAO_PADRAO,
            contatoId: contatoRow.uuid,
            contatoNome: contatoRow.nome,
            contatoTelefone: contatoRow.telefone ?? "",
            usuarioAtribuidoId: row.atribuidoUsuario?.uuid ?? null,
            usuarioAtribuidoNome: row.atribuidoUsuario?.nome ?? null,
            status: row.status,
            metaCloudJanelaExpiraEm: row.metaCloudJanelaExpiraEm?.toISOString() ?? null,
            ultimaMensagemEm: row.ultimaMensagemEm?.toISOString() ?? null,
            ultimaMensagemTipo: lastMsg?.tipo ?? null,
            ultimaMensagemPreview: lastMsg?.corpo ?? null,
            naoLidas: row.naoLidas ?? 0,
            etiquetas: etiquetasPorContato.get(String(contatoRow.id)) ?? [],
          };
        }),
      );
    },

    iniciar: async (
      ctx: WebContext,
      input: {
        instanciaId: string;
        telefone: string;
        nome?: string;
        corpo?: string;
        templateId?: string;
        variaveis?: Record<string, string>;
      },
    ) => {
      exigirAutenticacao(ctx);
      const { instance, role } = await exigirAcessoInstancia(ctx, input.instanciaId);
      verificarPodeEscreverCaixaEntrada(role);
      if (!isInstanceOperational(instance)) preconditionFailed("Instância não operacional");

      if (isMetaCloudProvider(instance.provedor) && !input.templateId) {
        preconditionFailed("Cloud API exige template para iniciar conversa");
      }
      if (isEvoProvider(instance.provedor) && !input.corpo) {
        preconditionFailed("Informe a mensagem inicial");
      }

      const phone = input.telefone.replace(/\D/g, "");
      const idExterno = `${phone}@s.whatsapp.net`;

      let contact = await ctx.db.query.contato.findFirst({
        where: and(
          eq(contato.organizacaoId, instance.organizacaoId),
          eq(contato.idExterno, idExterno),
          isNull(contato.excluidoEm),
        ),
        columns: colunasContatoCaixaEntrada,
      });
      if (!contact) {
        [contact] = await ctx.db
          .insert(contato)
          .values(
            comTimestampsCriacao({
              organizacaoId: instance.organizacaoId,
              idExterno,
              telefone: phone,
              nome: input.nome ?? null,
            }),
          )
          .returning();
      }

      const vinculoExistente = await ctx.db.query.contatoInstancia.findFirst({
        where: and(
          eq(contatoInstancia.contatoId, contact!.id),
          eq(contatoInstancia.instanciaId, instance.id),
        ),
        columns: colunasSomenteId,
      });
      if (!vinculoExistente) {
        await ctx.db.insert(contatoInstancia).values(
          comTimestampsCriacao({
            contatoId: contact!.id,
            instanciaId: instance.id,
            idExterno,
          }),
        );
      }

      const [conversation] = await ctx.db
        .insert(conversa)
        .values(
          comTimestampsCriacao({
            instanciaId: instance.id,
            contatoId: contact!.id,
            atribuidoUsuarioId: ctx.usuario!.internalId,
            ultimaMensagemEm: new Date(),
          }),
        )
        .returning();

      if (input.templateId) {
        const template = await ctx.db.query.mensagemTemplate.findFirst({
          where: and(
            eq(mensagemTemplate.uuid, input.templateId),
            isNull(mensagemTemplate.excluidoEm),
          ),
          columns: colunasMensagemTemplate,
        });
        if (!template) notFound("Template não encontrado");

        const externalId = await sendProviderMessage({
          ctx,
          instance,
          phone,
          type: "template",
          templateName: template.nome,
          templateLanguage: template.idioma,
          templateComponents: input.variaveis
            ? [
                {
                  type: "body",
                  parameters: Object.values(input.variaveis).map((text) => ({
                    type: "text",
                    text,
                  })),
                },
              ]
            : undefined,
        });

        await ctx.db.insert(mensagem).values(
          comCriadoEm({
            conversaId: conversation!.id,
            direcao: "outbound",
            tipo: "template",
            corpo: input.corpo ?? template.nome,
            templateNome: template.nome,
            templateIdioma: template.idioma,
            templateVariaveis: input.variaveis ?? null,
            idExterno: externalId,
            enviadoPorUsuarioId: ctx.usuario!.internalId,
          }),
        );
      } else if (input.corpo) {
        const externalId = await sendProviderMessage({
          ctx,
          instance,
          phone,
          type: "text",
          body: input.corpo,
        });
        await ctx.db.insert(mensagem).values(
          comCriadoEm({
            conversaId: conversation!.id,
            direcao: "outbound",
            tipo: "text",
            corpo: input.corpo,
            idExterno: externalId,
            enviadoPorUsuarioId: ctx.usuario!.internalId,
          }),
        );
      }

      return { conversaId: conversation!.uuid };
    },

    atribuir: async (ctx: WebContext, input: { conversaId: string; usuarioId: string | null }) => {
      exigirAutenticacao(ctx);
      const conv = await exigirAcessoConversa(ctx, input.conversaId);
      if (conv.role !== "admin" && conv.role !== "usuario") forbidden();

      let atribuidoUsuarioId: number | null = null;
      if (input.usuarioId) {
        atribuidoUsuarioId = await resolverIdInterno(ctx.db, "usuario", input.usuarioId);
        if (atribuidoUsuarioId === null) notFound();
      }

      await ctx.db
        .update(conversa)
        .set(comTimestampAtualizacao({ atribuidoUsuarioId }))
        .where(eq(conversa.id, conv.conversation.id));
      return { ok: true };
    },

    fechar: async (ctx: WebContext, input: { conversaId: string }) => {
      exigirAutenticacao(ctx);
      const conv = await exigirAcessoConversa(ctx, input.conversaId);
      await ctx.db
        .update(conversa)
        .set(comTimestampAtualizacao({ status: "closed", fechadoEm: new Date() }))
        .where(eq(conversa.id, conv.conversation.id));
      return { ok: true };
    },

    /** Sync on-demand do histórico WhatsApp da conversa (Evolution). */
    sincronizarHistorico: async (ctx: WebContext, input: { conversaId: string }) => {
      exigirAutenticacao(ctx);
      const conv = await exigirAcessoConversa(ctx, input.conversaId);
      if (!conv.contact) notFound();

      if (!isEvoProvider(conv.instance.provedor)) {
        preconditionFailed("Sincronização de histórico disponível apenas para WhatsApp Comercial");
      }
      if (conv.instance.status !== "connected") {
        preconditionFailed("Instância precisa estar conectada para sincronizar histórico");
      }
      const evoToken = conv.instance.evo?.token;
      if (!evoToken) {
        preconditionFailed("Instância Evolution sem token");
      }

      const result = await solicitarHistoricoSyncConversaEvolution(ctx.db, ctx.env, {
        instanciaId: conv.instance.id,
        instanciaUuid: conv.instance.uuid,
        evoToken,
        conversaIdInterno: conv.conversation.id,
        contatoId: conv.contact.id,
        telefone: conv.contact.telefone,
      });
      if (!result.ok) {
        preconditionFailed(result.motivo ?? "Não foi possível iniciar a sincronização");
      }

      return { ok: true };
    },
  },

  mensagens: {
    lista: async (ctx: WebContext, input: { conversaId: string }) => {
      exigirAutenticacao(ctx);
      const conv = await exigirAcessoConversa(ctx, input.conversaId);

      const rows = await ctx.db.query.mensagem.findMany({
        where: and(eq(mensagem.conversaId, conv.conversation.id), isNull(mensagem.excluidoEm)),
        columns: colunasMensagemLista,
        with: { enviadoPorUsuario: incluirUsuarioRelacao },
        orderBy: [asc(mensagem.criadoEm)],
      });

      const midiasAtualizadas = await garantirMidiasDaConversa(ctx, {
        instance: conv.instance,
        conversaIdInterno: conv.conversation.id,
        contatoId: conv.contact?.id ?? conv.conversation.contatoId,
        telefone: conv.contact?.telefone ?? null,
        rows,
      });

      return rows.map((m) =>
        mapearMensagemParaSaida(
          {
            ...m,
            midiaR2Chave: midiasAtualizadas.get(m.id) ?? m.midiaR2Chave,
          },
          ctx.env.CDN_URL,
        ),
      );
    },

    enviar: async (
      ctx: WebContext,
      input: {
        conversaId: string;
        tipo: string;
        body?: string;
        mediaUrl?: string;
        mediaR2Key?: string;
        filename?: string;
        voice?: boolean;
        latitude?: number;
        longitude?: number;
        localNome?: string;
        localEndereco?: string;
        contatos?: unknown[];
        interactive?: unknown;
        payload?: unknown;
        contextoMensagemId?: string;
        mensagemIdExterno?: string;
        emoji?: string;
      },
    ) => {
      exigirAutenticacao(ctx);
      const conv = await exigirAcessoConversa(ctx, input.conversaId);
      if (!conv.contact) notFound();

      verificarPodeEscreverCaixaEntrada(conv.role);
      if (!isInstanceOperational(conv.instance)) preconditionFailed("Instância não conectada");
      if (
        conv.role === "usuario" &&
        conv.conversation.atribuidoUsuarioId &&
        conv.conversation.atribuidoUsuarioId !== ctx.usuario!.internalId
      ) {
        forbidden("Conversa não atribuída a você");
      }

      const tipo = input.tipo;
      assertMessageTypeSupported(tipo, conv.instance.provedor);

      if (
        cloudRequiresTemplate(
          conv.instance.provedor,
          conv.conversation.metaCloudJanelaExpiraEm,
          false,
        ) &&
        tipo === "text" &&
        !isMetaCloudWindowOpen(conv.conversation.metaCloudJanelaExpiraEm)
      ) {
        preconditionFailed("Fora da janela de 24h — use um template");
      }

      const mediaUrl = resolverUrlMidia(ctx, input.mediaUrl, input.mediaR2Key);
      if (["image", "audio", "video", "document", "sticker"].includes(tipo) && !mediaUrl) {
        preconditionFailed("Mídia não informada");
      }

      if (!conv.contact.telefone) notFound("Telefone do contato não informado");

      const externalId = await sendProviderMessage({
        ctx,
        instance: conv.instance,
        phone: conv.contact.telefone,
        type: tipo,
        body: input.body,
        mediaUrl,
        mediaR2Key: input.mediaR2Key,
        caption: input.body,
        filename: input.filename,
        voice: input.voice,
        latitude: input.latitude,
        longitude: input.longitude,
        localNome: input.localNome,
        localEndereco: input.localEndereco,
        contatos: input.contatos,
        interactive: input.interactive,
        payload: input.payload,
        contextoMensagemId: input.contextoMensagemId,
        mensagemIdExterno: input.mensagemIdExterno,
        emoji: input.emoji,
      });

      const corpo =
        input.body ??
        (tipo === "reaction" ? (input.emoji ?? null) : null) ??
        (["button", "list", "carousel", "poll", "link", "interactive"].includes(tipo)
          ? `[${tipo}]`
          : null);

      const [message] = await ctx.db
        .insert(mensagem)
        .values(
          comCriadoEm({
            conversaId: conv.conversation.id,
            direcao: "outbound",
            tipo,
            corpo,
            midiaR2Chave: input.mediaR2Key ?? null,
            idExterno: externalId,
            enviadoPorUsuarioId: ctx.usuario!.internalId,
          }),
        )
        .returning();

      await ctx.db
        .update(conversa)
        .set(comTimestampAtualizacao({ ultimaMensagemEm: new Date() }))
        .where(eq(conversa.id, conv.conversation.id));

      const usuario = ctx.usuario!;
      return mapearMensagemParaSaida(
        {
          ...message!,
          enviadoPorUsuario: { uuid: usuario.id, nome: usuario.nome },
        },
        ctx.env.CDN_URL,
      );
    },

    marcarLido: async (
      ctx: WebContext,
      input: { conversaId: string; mensagemIdExterno: string },
    ) => {
      exigirAutenticacao(ctx);
      const conv = await exigirAcessoConversa(ctx, input.conversaId);
      if (!conv.contact) notFound();

      if (!conv.contact.telefone) notFound("Telefone do contato não informado");

      await markProviderMessageRead(
        ctx,
        conv.instance,
        conv.contact.telefone,
        input.mensagemIdExterno,
      );

      await ctx.db
        .update(conversa)
        .set(
          comTimestampAtualizacao({
            naoLidas: 0,
            ultimaLeituraEm: new Date(),
          }),
        )
        .where(eq(conversa.id, conv.conversation.id));

      return { ok: true };
    },

    enviarTemplate: async (
      ctx: WebContext,
      input: {
        conversaId: string;
        templateId: string;
        variaveis?: Record<string, string>;
      },
    ) => {
      exigirAutenticacao(ctx);
      const conv = await exigirAcessoConversa(ctx, input.conversaId);
      if (!conv.contact) notFound();
      verificarPodeEscreverCaixaEntrada(conv.role);

      const template = await ctx.db.query.mensagemTemplate.findFirst({
        where: and(
          eq(mensagemTemplate.uuid, input.templateId),
          isNull(mensagemTemplate.excluidoEm),
        ),
        columns: colunasMensagemTemplate,
      });
      if (!template) notFound("Template não encontrado");
      if (!conv.contact.telefone) notFound("Telefone do contato não informado");

      const externalId = await sendProviderMessage({
        ctx,
        instance: conv.instance,
        phone: conv.contact.telefone,
        type: "template",
        templateName: template.nome,
        templateLanguage: template.idioma,
        templateComponents: input.variaveis
          ? [
              {
                type: "body",
                parameters: Object.values(input.variaveis).map((text) => ({
                  type: "text",
                  text,
                })),
              },
            ]
          : undefined,
      });

      const [message] = await ctx.db
        .insert(mensagem)
        .values(
          comCriadoEm({
            conversaId: conv.conversation.id,
            direcao: "outbound",
            tipo: "template",
            corpo: template.nome,
            templateNome: template.nome,
            templateIdioma: template.idioma,
            templateVariaveis: input.variaveis ?? null,
            idExterno: externalId,
            enviadoPorUsuarioId: ctx.usuario!.internalId,
          }),
        )
        .returning();

      await ctx.db
        .update(conversa)
        .set(comTimestampAtualizacao({ ultimaMensagemEm: new Date() }))
        .where(eq(conversa.id, conv.conversation.id));

      const usuario = ctx.usuario!;
      return mapearMensagemParaSaida(
        {
          ...message!,
          enviadoPorUsuario: { uuid: usuario.id, nome: usuario.nome },
        },
        ctx.env.CDN_URL,
      );
    },
  },

  templates: {
    lista: async (ctx: WebContext, input: { instanciaId: string }) => {
      exigirAutenticacao(ctx);
      const { instance } = await exigirAcessoInstancia(ctx, input.instanciaId);

      const rows = await ctx.db.query.mensagemTemplate.findMany({
        where: and(
          eq(mensagemTemplate.instanciaId, instance.id),
          isNull(mensagemTemplate.excluidoEm),
        ),
        columns: {
          uuid: true,
          nome: true,
          idioma: true,
          categoria: true,
          status: true,
          componentes: true,
        },
      });

      return rows.map((t) => ({
        id: t.uuid,
        nome: t.nome,
        idioma: t.idioma,
        categoria: t.categoria,
        status: t.status,
        componentes: t.componentes,
      }));
    },

    sincronizar: async (ctx: WebContext, input: { instanciaId: string }) => {
      exigirAutenticacao(ctx);
      const { instance } = await exigirAcessoInstancia(ctx, input.instanciaId);
      if (!isMetaCloudProvider(instance.provedor)) preconditionFailed("Somente Cloud API");

      const creds = obterCredenciaisMeta(instance);
      const meta = criarClienteMeta(ctx.env, creds, {
        origem: "templates.sincronizar",
        rpc: "caixaEntrada.templates.sincronizar",
        instanciaUuid: instance.uuid,
      });
      const { data } = await meta.listTemplates();

      await Promise.all(data.map((tpl) => sincronizarTemplateMeta(ctx, instance.id, tpl)));

      return { sincronizados: data.length };
    },
  },

  anotacoes: {
    lista: async (ctx: WebContext, input: { conversaId: string }) => {
      exigirAutenticacao(ctx);
      const conv = await exigirAcessoConversa(ctx, input.conversaId);

      const rows = await ctx.db.query.conversaAnotacao.findMany({
        where: and(
          eq(conversaAnotacao.conversaId, conv.conversation.id),
          isNull(conversaAnotacao.excluidoEm),
        ),
        columns: colunasConversaAnotacao,
        with: { autorUsuario: incluirUsuarioRelacao },
        orderBy: [asc(conversaAnotacao.criadoEm)],
      });

      return rows
        .filter((r) => r.autorUsuario)
        .map((r) => ({
          id: r.uuid,
          body: r.corpo,
          autorUsuarioId: r.autorUsuario!.uuid,
          autorNome: r.autorUsuario!.nome,
          criadoEm: r.criadoEm.toISOString(),
        }));
    },

    criar: async (ctx: WebContext, input: { conversaId: string; body: string }) => {
      exigirAutenticacao(ctx);
      const conv = await exigirAcessoConversa(ctx, input.conversaId);
      verificarPodeEscreverCaixaEntrada(conv.role);

      const [note] = await ctx.db
        .insert(conversaAnotacao)
        .values(
          comTimestampsCriacao({
            conversaId: conv.conversation.id,
            autorUsuarioId: ctx.usuario!.internalId,
            corpo: input.body,
          }),
        )
        .returning();
      return { id: note!.uuid };
    },
  },

  etiquetas: {
    lista: async (ctx: WebContext, input: { organizacaoHash: string }) => {
      exigirAutenticacao(ctx);
      await resolverMembro(ctx, input.organizacaoHash);
      const organizacaoId = await resolverIdInterno(ctx.db, "organizacao", input.organizacaoHash);
      if (organizacaoId === null) notFound();

      const rows = await ctx.db.query.contatoTag.findMany({
        where: eq(contatoTag.organizacaoId, organizacaoId),
        columns: colunasContatoTag,
        orderBy: [asc(contatoTag.nome)],
      });

      return rows.map((row) => ({
        id: row.uuid,
        nome: row.nome,
        cor: row.cor,
      }));
    },

    porContato: async (ctx: WebContext, input: { contatoId: string }) => {
      exigirAutenticacao(ctx);
      const { contact } = await exigirAcessoContato(ctx, input.contatoId);

      const rows = await ctx.db.query.contatoTagAtribuicao.findMany({
        where: eq(contatoTagAtribuicao.contatoId, contact.id),
        with: { tag: { columns: colunasContatoTag } },
      });

      return rows
        .filter((row) => row.tag)
        .map((row) => ({
          id: row.tag!.uuid,
          nome: row.tag!.nome,
          cor: row.tag!.cor,
        }));
    },

    atribuir: async (ctx: WebContext, input: { contatoId: string; etiquetaId: string }) => {
      exigirAutenticacao(ctx);
      const { contact, role, organizacaoId } = await exigirAcessoContato(ctx, input.contatoId);
      verificarPodeEscreverCaixaEntrada(role);

      const tag = await ctx.db.query.contatoTag.findFirst({
        where: eq(contatoTag.uuid, input.etiquetaId),
        columns: colunasContatoTag,
      });
      if (!tag || tag.organizacaoId !== organizacaoId) {
        notFound("Etiqueta não encontrada");
      }

      const evoInstance = await resolverInstanciaEvoDoContato(ctx, contact.id);

      const labelId =
        evoInstance && isEvoProvider(evoInstance.provedor)
          ? await garantirEtiquetaEvolution(ctx, evoInstance, tag)
          : tag.idExterno;

      if (labelId && tag.idExterno !== labelId) {
        await ctx.db
          .update(contatoTag)
          .set({ idExterno: labelId })
          .where(eq(contatoTag.id, tag.id));
      }

      const existing = await ctx.db.query.contatoTagAtribuicao.findFirst({
        where: and(
          eq(contatoTagAtribuicao.contatoId, contact.id),
          eq(contatoTagAtribuicao.tagId, tag.id),
        ),
        columns: colunasSomenteId,
      });
      if (!existing) {
        await ctx.db.insert(contatoTagAtribuicao).values(
          comCriadoEm({
            contatoId: contact.id,
            tagId: tag.id,
          }),
        );
      }

      if (labelId && evoInstance && isEvoProvider(evoInstance.provedor)) {
        const idExternoLinha = await resolverIdExternoLinhaContato(ctx, contact.id, evoInstance.id);
        await atribuirEtiquetaEvolution(
          ctx,
          evoInstance,
          { telefone: contact.telefone, idExternoLinha },
          labelId,
        );
      }

      return { ok: true };
    },

    remover: async (ctx: WebContext, input: { contatoId: string; etiquetaId: string }) => {
      exigirAutenticacao(ctx);
      const { contact, role } = await exigirAcessoContato(ctx, input.contatoId);
      verificarPodeEscreverCaixaEntrada(role);

      const tag = await ctx.db.query.contatoTag.findFirst({
        where: eq(contatoTag.uuid, input.etiquetaId),
        columns: { ...colunasContatoTag },
      });
      if (!tag) notFound("Etiqueta não encontrada");

      const evoInstance = await resolverInstanciaEvoDoContato(ctx, contact.id);
      if (tag.idExterno && evoInstance && isEvoProvider(evoInstance.provedor)) {
        const idExternoLinha = await resolverIdExternoLinhaContato(ctx, contact.id, evoInstance.id);
        await removerEtiquetaEvolution(
          ctx,
          evoInstance,
          { telefone: contact.telefone, idExternoLinha },
          tag.idExterno,
        );
      }

      await ctx.db
        .delete(contatoTagAtribuicao)
        .where(
          and(
            eq(contatoTagAtribuicao.contatoId, contact.id),
            eq(contatoTagAtribuicao.tagId, tag.id),
          ),
        );
      return { ok: true };
    },

    criar: async (
      ctx: WebContext,
      input: {
        organizacaoHash: string;
        nome: string;
        cor?: string | null;
        contatoId?: string;
        instanciaId?: string;
      },
    ) => {
      exigirAutenticacao(ctx);
      const { role } = await resolverMembro(ctx, input.organizacaoHash);
      verificarPodeEscreverCaixaEntrada(role);

      const organizacaoId = await resolverIdInterno(ctx.db, "organizacao", input.organizacaoHash);
      if (organizacaoId === null) notFound();

      let instanceForEvolution: InstanciaComProvedor | null = null;
      let contactForAssign: Awaited<ReturnType<typeof exigirAcessoContato>>["contact"] | null =
        null;

      if (input.contatoId) {
        const access = await exigirAcessoContato(ctx, input.contatoId);
        if (access.organizacaoId !== organizacaoId) notFound("Contato não encontrado");
        contactForAssign = access.contact;
        instanceForEvolution =
          (await resolverInstanciaEvoDoContato(ctx, access.contact.id)) ??
          (input.instanciaId
            ? (await exigirAcessoInstancia(ctx, input.instanciaId)).instance
            : null);
      } else if (input.instanciaId) {
        const access = await exigirAcessoInstancia(ctx, input.instanciaId);
        if (access.instance.organizacaoId !== organizacaoId) notFound();
        instanceForEvolution = access.instance;
      }

      let idExterno: string | null = null;
      if (instanceForEvolution && isEvoProvider(instanceForEvolution.provedor)) {
        idExterno = await criarEtiquetaEvolution(ctx, instanceForEvolution, input.nome, input.cor);
      }

      const [tag] = await ctx.db
        .insert(contatoTag)
        .values(
          comCriadoEm({
            organizacaoId,
            nome: input.nome,
            cor: input.cor ?? null,
            idExterno,
          }),
        )
        .returning({
          id: contatoTag.id,
          uuid: contatoTag.uuid,
          nome: contatoTag.nome,
          cor: contatoTag.cor,
        });

      if (contactForAssign && instanceForEvolution) {
        await ctx.db.insert(contatoTagAtribuicao).values(
          comCriadoEm({
            contatoId: contactForAssign.id,
            tagId: tag!.id,
          }),
        );

        if (idExterno && isEvoProvider(instanceForEvolution.provedor)) {
          const idExternoLinha = await resolverIdExternoLinhaContato(
            ctx,
            contactForAssign.id,
            instanceForEvolution.id,
          );
          await atribuirEtiquetaEvolution(
            ctx,
            instanceForEvolution,
            { telefone: contactForAssign.telefone, idExternoLinha },
            idExterno,
          );
        }
      }

      return {
        id: tag!.uuid,
        nome: tag!.nome,
        cor: tag!.cor,
      };
    },
  },

  contatos: {
    /**
     * Lista paginada de contatos da organização, com instâncias e atendente da conversa aberta.
     */
    lista: async (
      ctx: WebContext,
      input: {
        organizacaoHash: string;
        busca?: string;
        instanciaId?: string;
        limite?: number;
        offset?: number;
      },
    ) => {
      exigirAutenticacao(ctx);
      await resolverMembro(ctx, input.organizacaoHash);
      const organizacaoId = await resolverIdInterno(ctx.db, "organizacao", input.organizacaoHash);
      if (organizacaoId === null) notFound();
      const limite = input.limite ?? 30;
      const offset = input.offset ?? 0;
      const busca = input.busca?.trim();

      const filtros: SQL[] = [eq(contato.organizacaoId, organizacaoId), isNull(contato.excluidoEm)];

      if (busca) {
        const termo = `%${busca}%`;
        filtros.push(or(ilike(contato.nome, termo), ilike(contato.telefone, termo))!);
      }

      if (input.instanciaId) {
        const { instance } = await exigirAcessoInstancia(ctx, input.instanciaId);
        if (instance.organizacaoId !== organizacaoId) notFound();
        const vinculos = await ctx.db.query.contatoInstancia.findMany({
          where: eq(contatoInstancia.instanciaId, instance.id),
          columns: { contatoId: true },
        });
        const ids = vinculos.map((v) => v.contatoId);
        if (ids.length === 0) return { itens: [], total: 0 };
        filtros.push(inArray(contato.id, ids));
      }

      const where = and(...filtros);

      const [[totalRow], rows] = await Promise.all([
        ctx.db.select({ n: count() }).from(contato).where(where),
        ctx.db.query.contato.findMany({
          where,
          columns: {
            id: true,
            uuid: true,
            nome: true,
            telefone: true,
            criadoEm: true,
          },
          orderBy: [desc(contato.atualizadoEm), desc(contato.id)],
          limit: limite,
          offset,
        }),
      ]);

      const itens = await montarItensContatoLista(ctx, rows);
      return { itens, total: totalRow?.n ?? 0 };
    },

    /**
     * Cria (ou reaproveita) contato e vínculo com a instância, sem abrir conversa.
     */
    criar: async (
      ctx: WebContext,
      input: {
        organizacaoHash: string;
        instanciaId: string;
        telefone: string;
        nome?: string;
      },
    ) => {
      exigirAutenticacao(ctx);
      await resolverMembro(ctx, input.organizacaoHash);
      const { instance, role } = await exigirAcessoInstancia(ctx, input.instanciaId);
      verificarPodeEscreverCaixaEntrada(role);

      const organizacaoId = await resolverIdInterno(ctx.db, "organizacao", input.organizacaoHash);
      if (organizacaoId === null || instance.organizacaoId !== organizacaoId) notFound();
      const { phone, idExterno } = normalizarTelefoneContato(input.telefone);
      if (phone.length < 8) preconditionFailed("Telefone inválido");

      const nome = input.nome?.trim() || null;

      let contact = await ctx.db.query.contato.findFirst({
        where: and(
          eq(contato.organizacaoId, organizacaoId),
          eq(contato.idExterno, idExterno),
          isNull(contato.excluidoEm),
        ),
        columns: {
          id: true,
          uuid: true,
          nome: true,
          telefone: true,
          criadoEm: true,
        },
      });

      if (!contact) {
        [contact] = await ctx.db
          .insert(contato)
          .values(
            comTimestampsCriacao({
              organizacaoId,
              idExterno,
              telefone: phone,
              nome,
            }),
          )
          .returning({
            id: contato.id,
            uuid: contato.uuid,
            nome: contato.nome,
            telefone: contato.telefone,
            criadoEm: contato.criadoEm,
          });
      } else if (nome && !contact.nome) {
        await ctx.db
          .update(contato)
          .set(comTimestampAtualizacao({ nome }))
          .where(eq(contato.id, contact.id));
        contact = { ...contact, nome };
      }

      const vinculoExistente = await ctx.db.query.contatoInstancia.findFirst({
        where: and(
          eq(contatoInstancia.contatoId, contact!.id),
          eq(contatoInstancia.instanciaId, instance.id),
        ),
        columns: colunasSomenteId,
      });
      if (!vinculoExistente) {
        await ctx.db.insert(contatoInstancia).values(
          comTimestampsCriacao({
            contatoId: contact!.id,
            instanciaId: instance.id,
            idExterno,
          }),
        );
      }

      const [item] = await montarItensContatoLista(ctx, [contact!]);
      return item!;
    },

    atualizar: async (ctx: WebContext, input: { contatoId: string; nome: string }) => {
      return caixaEntradaHandlers.contatos.atualizarNome(ctx, input);
    },

    atualizarNome: async (ctx: WebContext, input: { contatoId: string; nome: string }) => {
      exigirAutenticacao(ctx);
      const { contact, role } = await exigirAcessoContato(ctx, input.contatoId);
      verificarPodeEscreverCaixaEntrada(role);

      const nome = input.nome.trim() || null;

      await ctx.db
        .update(contato)
        .set(comTimestampAtualizacao({ nome }))
        .where(eq(contato.id, contact.id));

      return { ok: true, nome };
    },

    /** Soft-delete do contato da organização. */
    remover: async (ctx: WebContext, input: { contatoId: string }) => {
      exigirAutenticacao(ctx);
      const { contact, role } = await exigirAcessoContato(ctx, input.contatoId);
      verificarPodeEscreverCaixaEntrada(role);

      await ctx.db
        .update(contato)
        .set(comTimestampAtualizacao(marcarExclusaoLogica()))
        .where(eq(contato.id, contact.id));

      return { ok: true };
    },
  },

  midia: {
    upload: async (
      ctx: WebContext,
      input: {
        conversaId: string;
        tipo: "image" | "audio" | "video" | "document";
        nomeArquivo: string;
        tipoConteudo: string;
        dados: string;
      },
    ) => {
      exigirAutenticacao(ctx);
      if (!ctx.env.R2) preconditionFailed("Armazenamento de mídia não configurado");

      const conv = await exigirAcessoConversa(ctx, input.conversaId);
      verificarPodeEscreverCaixaEntrada(conv.role);
      if (!mimeCompativelComTipo(input.tipo, input.tipoConteudo)) {
        preconditionFailed("Tipo de arquivo incompatível com o anexo selecionado");
      }

      const buffer = base64ParaArrayBuffer(input.dados);
      if (buffer.byteLength > LIMITE_MIDIA_BYTES) {
        preconditionFailed("Arquivo muito grande (máx. 20 MB)");
      }
      if (buffer.byteLength === 0) preconditionFailed("Arquivo vazio");

      const ext = mimeToExtension(input.tipoConteudo, input.nomeArquivo);
      const r2Key = buildOutboundMediaR2Key(conv.instance.uuid, ext);

      const bucket = ctx.env.CDN_R2 ?? ctx.env.R2;
      if (!bucket) preconditionFailed("Storage de mídia não configurado");

      await bucket.put(r2Key, buffer, {
        httpMetadata: { contentType: input.tipoConteudo.split(";")[0]?.trim() },
      });

      if (!ctx.env.CDN_URL) preconditionFailed("CDN não configurado");

      return {
        mediaR2Key: r2Key,
        mediaUrl: cdnMediaUrl(ctx.env.CDN_URL, r2Key),
      };
    },
  },
};
