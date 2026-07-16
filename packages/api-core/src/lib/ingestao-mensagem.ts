/**
 * Persistência de mensagens inbound/outbound: contato org, vínculo por instância, conversa e mensagem.
 */
import {
  colunasContatoCaixaEntrada,
  colunasContatoInstancia,
  comCriadoEm,
  comTimestampAtualizacao,
  comTimestampsCriacao,
  contato,
  contatoInstancia,
  conversa,
  type Db,
  marcarExclusaoLogica,
  mensagem,
  usoMensal,
  usoMensalContato,
} from "@whasap/db";
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";

export type IngerirMensagemParams = {
  instanciaId: number;
  organizacaoId: number;
  phone: string;
  contactName: string | null;
  /** JID/LID/wa_id raw desta linha (contato_instancia). */
  idExternoLinha: string;
  /** Identidade canônica na org (contato.idExterno). */
  idExternoCanonico: string;
  body: string;
  type: string;
  externalId: string | null;
  provedor: "evo" | "meta_cloud";
  direcao?: "inbound" | "outbound";
  /** Horário do evento no WhatsApp; default = agora. */
  enviadoEm?: Date;
  status?: string;
  metadados?: Record<string, unknown>;
  naoLidasDelta?: number;
  naoLidasInicial?: number;
  ultimaMensagemEm?: Date;
};

/**
 * Serializa Date para parametro SQL (ISO-8601).
 * Date cru no template sql vira Date.toString() ("Wed Sep 18 ...") e o Postgres rejeita.
 */
export function isoTimestampParaSql(nova: Date): string {
  return Number.isNaN(nova.getTime()) ? new Date().toISOString() : nova.toISOString();
}

/** Atualiza `ultima_mensagem_em` só se o novo valor for mais recente (race-safe). */
export function sqlUltimaMensagemMonotonica(nova: Date) {
  const iso = isoTimestampParaSql(nova);
  const ts = sql`${sql.param(iso)}::timestamp`;
  return sql`CASE
    WHEN ${conversa.ultimaMensagemEm} IS NULL OR ${conversa.ultimaMensagemEm} < ${ts}
    THEN ${ts}
    ELSE ${conversa.ultimaMensagemEm}
  END`;
}

/** Atualiza preview só quando `ultima_mensagem_em` avança (mesmo critério monotônico). */
function sqlPreviewSeMaisRecente(nova: Date, valor: string | null, coluna: "corpo" | "tipo") {
  const iso = isoTimestampParaSql(nova);
  const ts = sql`${sql.param(iso)}::timestamp`;
  const atual =
    coluna === "corpo" ? conversa.ultimaMensagemCorpo : conversa.ultimaMensagemTipo;
  return sql`CASE
    WHEN ${conversa.ultimaMensagemEm} IS NULL OR ${conversa.ultimaMensagemEm} < ${ts}
    THEN ${valor}
    ELSE ${atual}
  END`;
}

/**
 * Campos de `conversa` para espelhar a última mensagem (timestamp + preview).
 * Usar no mesmo UPDATE pós-insert/envio.
 */
export function camposUltimaMensagemConversa(params: {
  enviadoEm: Date;
  corpo: string | null;
  tipo: string;
  naoLidas?: number;
}) {
  const set: Record<string, unknown> = {
    ultimaMensagemEm: sqlUltimaMensagemMonotonica(params.enviadoEm),
    ultimaMensagemCorpo: sqlPreviewSeMaisRecente(params.enviadoEm, params.corpo, "corpo"),
    ultimaMensagemTipo: sqlPreviewSeMaisRecente(params.enviadoEm, params.tipo, "tipo"),
    atualizadoEm: new Date(),
  };
  if (params.naoLidas !== undefined) {
    set.naoLidas = params.naoLidas;
  }
  return set;
}

async function buscarOuCriarContatoOrg(
  db: Db,
  params: IngerirMensagemParams,
): Promise<{ id: number }> {
  let contact = await db.query.contato.findFirst({
    where: and(
      eq(contato.organizacaoId, params.organizacaoId),
      eq(contato.idExterno, params.idExternoCanonico),
      isNull(contato.excluidoEm),
    ),
    columns: colunasContatoCaixaEntrada,
  });

  if (!contact) {
    const [created] = await db
      .insert(contato)
      .values(
        comTimestampsCriacao({
          organizacaoId: params.organizacaoId,
          idExterno: params.idExternoCanonico,
          telefone: params.phone,
          nome: params.contactName,
        }),
      )
      .onConflictDoUpdate({
        target: [contato.organizacaoId, contato.idExterno],
        set: {
          nome: sql`COALESCE(${contato.nome}, excluded.nome)`,
          telefone: sql`COALESCE(${contato.telefone}, excluded.telefone)`,
          atualizadoEm: new Date(),
        },
      })
      .returning({ id: contato.id });
    return { id: created!.id };
  }

  const updates: Record<string, unknown> = {};
  if (params.contactName && !contact.nome) updates.nome = params.contactName;
  if (params.phone && !contact.telefone) updates.telefone = params.phone;
  if (Object.keys(updates).length > 0) {
    await db
      .update(contato)
      .set(comTimestampAtualizacao(updates as never))
      .where(eq(contato.id, contact.id));
  }

  return { id: contact.id };
}

async function buscarOuCriarContatoInstancia(
  db: Db,
  params: IngerirMensagemParams,
  contatoId: number,
): Promise<void> {
  const existing = await db.query.contatoInstancia.findFirst({
    where: or(
      and(
        eq(contatoInstancia.instanciaId, params.instanciaId),
        eq(contatoInstancia.idExterno, params.idExternoLinha),
      ),
      and(
        eq(contatoInstancia.contatoId, contatoId),
        eq(contatoInstancia.instanciaId, params.instanciaId),
      ),
    ),
    columns: colunasContatoInstancia,
  });

  if (existing) {
    const set: Record<string, unknown> = {};
    if (existing.contatoId !== contatoId) set.contatoId = contatoId;
    if (existing.idExterno !== params.idExternoLinha) set.idExterno = params.idExternoLinha;
    if (Object.keys(set).length === 0) return;
    await db
      .update(contatoInstancia)
      .set(comTimestampAtualizacao(set as never))
      .where(eq(contatoInstancia.id, existing.id));
    return;
  }

  await db
    .insert(contatoInstancia)
    .values(
      comTimestampsCriacao({
        contatoId,
        instanciaId: params.instanciaId,
        idExterno: params.idExternoLinha,
      }),
    )
    .onConflictDoUpdate({
      target: [contatoInstancia.instanciaId, contatoInstancia.idExterno],
      set: comTimestampAtualizacao({ contatoId }),
    });
}

/**
 * Resolve conversa aberta — sem UPDATE antecipado (preview/timestamp vão no UPDATE único pós-mensagem).
 * Se a conversa estiver arquivada no painel, desarquiva ao receber/enviar mensagem.
 */
async function buscarOuCriarConversa(
  db: Db,
  params: IngerirMensagemParams,
  contactId: number,
): Promise<{ id: number; naoLidas: number }> {
  const conversation = await db.query.conversa.findFirst({
    where: and(
      eq(conversa.instanciaId, params.instanciaId),
      eq(conversa.contatoId, contactId),
      eq(conversa.status, "open"),
      isNull(conversa.excluidoEm),
    ),
    columns: { id: true, naoLidas: true, arquivadoEm: true },
  });

  if (conversation) {
    if (conversation.arquivadoEm) {
      await db
        .update(conversa)
        .set(comTimestampAtualizacao({ arquivadoEm: null }))
        .where(eq(conversa.id, conversation.id));
    }
    return { id: conversation.id, naoLidas: conversation.naoLidas };
  }

  const ultimaEm = params.ultimaMensagemEm ?? params.enviadoEm ?? new Date();
  const isMetaCloud = params.provedor === "meta_cloud";

  const [created] = await db
    .insert(conversa)
    .values(
      comTimestampsCriacao({
        instanciaId: params.instanciaId,
        contatoId: contactId,
        ultimaMensagemEm: ultimaEm,
        ultimaMensagemCorpo: params.body || null,
        ultimaMensagemTipo: params.type,
        naoLidas: params.naoLidasInicial ?? 0,
        ...(isMetaCloud
          ? { metaCloudJanelaExpiraEm: new Date(Date.now() + 24 * 60 * 60 * 1000) }
          : {}),
      }),
    )
    .returning({ id: conversa.id, naoLidas: conversa.naoLidas });

  return { id: created!.id, naoLidas: created!.naoLidas };
}

/**
 * Persiste mensagem: contato org, vínculo instância, conversa, mensagem e uso mensal.
 * Idempotente por `externalId` quando informado — retorna a existente (`created: false`)
 * para permitir backfill de mídia sem recriar a linha.
 * Revoke (`type: "revoke"`): soft-delete da mensagem alvo; não cria linha nova.
 */
export async function ingerirMensagem(
  db: Db,
  params: IngerirMensagemParams,
): Promise<{
  messageId: number;
  conversaId: number;
  created: boolean;
  midiaR2Chave: string | null;
} | null> {
  if (params.type === "revoke") {
    const idAlvo = params.body.trim();
    if (!idAlvo || idAlvo === "[mensagem apagada]") return null;
    const revoked = await aplicarRevokeMensagem(db, { idExternoAlvo: idAlvo });
    if (!revoked) return null;
    return {
      messageId: revoked.messageId,
      conversaId: revoked.conversaId,
      created: false,
      midiaR2Chave: null,
    };
  }

  if (params.externalId) {
    const existing = await db.query.mensagem.findFirst({
      where: and(eq(mensagem.idExterno, params.externalId), isNull(mensagem.excluidoEm)),
      columns: { id: true, conversaId: true, midiaR2Chave: true },
    });
    if (existing) {
      return {
        messageId: existing.id,
        conversaId: existing.conversaId,
        created: false,
        midiaR2Chave: existing.midiaR2Chave ?? null,
      };
    }
  }

  const contact = await buscarOuCriarContatoOrg(db, params);
  await buscarOuCriarContatoInstancia(db, params, contact.id);
  const conversation = await buscarOuCriarConversa(db, params, contact.id);

  const direcao = params.direcao ?? "inbound";
  const enviadoEm = params.enviadoEm ?? new Date();
  const ultimaEm = params.ultimaMensagemEm ?? enviadoEm;

  const metadados = {
    provedor: params.provedor,
    instanciaId: params.instanciaId,
    idExternoLinha: params.idExternoLinha,
    ...params.metadados,
  };

  const insertQuery = db
    .insert(mensagem)
    .values(
      comCriadoEm({
        conversaId: conversation.id,
        direcao,
        tipo: params.type,
        corpo: params.body,
        idExterno: params.externalId,
        status: params.status ?? (direcao === "outbound" ? "sent" : "delivered"),
        metadados,
        enviadoEm,
      }),
    );

  const [message] = params.externalId
    ? await insertQuery
        .onConflictDoNothing({
          target: mensagem.idExterno,
          where: sql`${mensagem.idExterno} IS NOT NULL AND ${mensagem.excluidoEm} IS NULL`,
        })
        .returning()
    : await insertQuery.returning();

  if (!message) {
    if (!params.externalId) return null;
    const existing = await db.query.mensagem.findFirst({
      where: and(eq(mensagem.idExterno, params.externalId), isNull(mensagem.excluidoEm)),
      columns: { id: true, conversaId: true, midiaR2Chave: true },
    });
    if (!existing) return null;
    return {
      messageId: existing.id,
      conversaId: existing.conversaId,
      created: false,
      midiaR2Chave: existing.midiaR2Chave ?? null,
    };
  }

  let naoLidas = conversation.naoLidas ?? 0;
  if (params.naoLidasInicial !== undefined && params.naoLidasInicial > naoLidas) {
    naoLidas = params.naoLidasInicial;
  }
  if (params.naoLidasDelta && params.naoLidasDelta !== 0) {
    naoLidas = Math.max(0, naoLidas + params.naoLidasDelta);
  }

  const setValues = camposUltimaMensagemConversa({
    enviadoEm: ultimaEm,
    corpo: params.body || null,
    tipo: params.type,
    ...(naoLidas !== conversation.naoLidas ? { naoLidas } : {}),
  });

  if (params.provedor === "meta_cloud") {
    setValues.metaCloudJanelaExpiraEm = new Date(Date.now() + 24 * 60 * 60 * 1000);
  }

  await db
    .update(conversa)
    .set(setValues as never)
    .where(eq(conversa.id, conversation.id));

  if (direcao === "inbound") {
    await incrementarUsoMensal(db, params.instanciaId, contact.id);
  }

  return {
    messageId: message.id,
    conversaId: conversation.id,
    created: true,
    midiaR2Chave: null,
  };
}

async function incrementarUsoMensal(db: Db, instanciaId: number, contatoId: number) {
  const anoMes = new Date().toISOString().slice(0, 7);
  const [inserido] = await db
    .insert(usoMensalContato)
    .values({
      instanciaId,
      contatoId,
      anoMes,
      contadoEm: new Date(),
    })
    .onConflictDoNothing({
      target: [usoMensalContato.instanciaId, usoMensalContato.contatoId, usoMensalContato.anoMes],
    })
    .returning({ id: usoMensalContato.id });

  if (!inserido) return;

  await db
    .insert(usoMensal)
    .values({
      instanciaId,
      anoMes,
      contatosUnicosContagem: 1,
      atualizadoEm: new Date(),
    })
    .onConflictDoUpdate({
      target: [usoMensal.instanciaId, usoMensal.anoMes],
      set: {
        contatosUnicosContagem: sql`${usoMensal.contatosUnicosContagem} + 1`,
        atualizadoEm: new Date(),
      },
    });
}

/** Busca contato org por id externo canônico ou telefone. */
export async function buscarContatoPorIdExterno(
  db: Db,
  organizacaoId: number,
  idExternoCanonico: string,
  telefone: string,
) {
  const byId = await db.query.contato.findFirst({
    where: and(
      eq(contato.organizacaoId, organizacaoId),
      eq(contato.idExterno, idExternoCanonico),
      isNull(contato.excluidoEm),
    ),
    columns: colunasContatoCaixaEntrada,
  });
  if (byId) return byId;

  return db.query.contato.findFirst({
    where: and(
      eq(contato.organizacaoId, organizacaoId),
      eq(contato.telefone, telefone),
      isNull(contato.excluidoEm),
    ),
    columns: colunasContatoCaixaEntrada,
  });
}

/** Atualiza status de entrega de mensagem outbound. */
export async function atualizarStatusMensagemPorIdExterno(
  db: Db,
  externalId: string,
  status: string,
): Promise<number | null> {
  const [updated] = await db
    .update(mensagem)
    .set({ status })
    .where(and(eq(mensagem.idExterno, externalId), isNull(mensagem.excluidoEm)))
    .returning({ conversaId: mensagem.conversaId });
  return updated?.conversaId ?? null;
}

/** Busca mensagem por id externo com metadados (ex.: messageSecret para edições). */
export async function buscarMensagemPorIdExterno(
  db: Db,
  idExterno: string,
): Promise<{
  id: number;
  conversaId: number;
  corpo: string | null;
  tipo: string;
  enviadoEm: Date;
  metadados: Record<string, unknown> | null;
} | null> {
  const row = await db.query.mensagem.findFirst({
    where: and(eq(mensagem.idExterno, idExterno), isNull(mensagem.excluidoEm)),
    columns: {
      id: true,
      conversaId: true,
      corpo: true,
      tipo: true,
      enviadoEm: true,
      metadados: true,
    },
  });
  if (!row) return null;
  const metadados =
    row.metadados && typeof row.metadados === "object"
      ? (row.metadados as Record<string, unknown>)
      : null;
  return {
    id: row.id,
    conversaId: row.conversaId,
    corpo: row.corpo,
    tipo: row.tipo,
    enviadoEm: row.enviadoEm,
    metadados,
  };
}

/**
 * Aplica edição de mensagem: atualiza `corpo` da original e marca `metadados.editadoEm`.
 * Se for a última mensagem da conversa, atualiza o preview.
 */
export async function aplicarEdicaoMensagem(
  db: Db,
  params: {
    idExternoAlvo: string;
    novoCorpo: string;
    editadoEm?: Date;
  },
): Promise<{ messageId: number; conversaId: number } | null> {
  const existing = await buscarMensagemPorIdExterno(db, params.idExternoAlvo);
  if (!existing) return null;

  const editadoEm = params.editadoEm ?? new Date();
  const metadados = {
    ...(existing.metadados ?? {}),
    editadoEm: editadoEm.toISOString(),
  };

  await db
    .update(mensagem)
    .set({ corpo: params.novoCorpo, metadados })
    .where(eq(mensagem.id, existing.id));

  const ultima = await db.query.mensagem.findFirst({
    where: and(eq(mensagem.conversaId, existing.conversaId), isNull(mensagem.excluidoEm)),
    orderBy: [desc(mensagem.enviadoEm), desc(mensagem.id)],
    columns: { id: true },
  });

  if (ultima?.id === existing.id) {
    await db
      .update(conversa)
      .set(
        comTimestampAtualizacao({
          ultimaMensagemCorpo: params.novoCorpo,
        }),
      )
      .where(eq(conversa.id, existing.conversaId));
  }

  return { messageId: existing.id, conversaId: existing.conversaId };
}

/**
 * Soft-delete da mensagem alvo de um revoke WhatsApp e recalcula o preview da conversa.
 */
export async function aplicarRevokeMensagem(
  db: Db,
  params: { idExternoAlvo: string },
): Promise<{ messageId: number; conversaId: number } | null> {
  const existing = await buscarMensagemPorIdExterno(db, params.idExternoAlvo);
  if (!existing) return null;

  await db
    .update(mensagem)
    .set(marcarExclusaoLogica())
    .where(eq(mensagem.id, existing.id));

  const anterior = await db.query.mensagem.findFirst({
    where: and(eq(mensagem.conversaId, existing.conversaId), isNull(mensagem.excluidoEm)),
    columns: { corpo: true, tipo: true, enviadoEm: true },
    orderBy: [desc(mensagem.enviadoEm), desc(mensagem.id)],
  });

  await db
    .update(conversa)
    .set(
      comTimestampAtualizacao({
        ultimaMensagemEm: anterior?.enviadoEm ?? null,
        ultimaMensagemCorpo: anterior?.corpo ?? null,
        ultimaMensagemTipo: anterior?.tipo ?? null,
      }),
    )
    .where(eq(conversa.id, existing.conversaId));

  return { messageId: existing.id, conversaId: existing.conversaId };
}

/** Decrementa não lidas da conversa (floor 0). */
export async function decrementarNaoLidas(db: Db, conversaId: number, quantidade = 1) {
  await db
    .update(conversa)
    .set(
      comTimestampAtualizacao({
        naoLidas: sql`GREATEST(0, ${conversa.naoLidas} - ${quantidade})`,
      }),
    )
    .where(eq(conversa.id, conversaId));
}

/** Zera não lidas e registra última leitura. */
export async function marcarConversaLidaLocal(db: Db, conversaId: number) {
  await db
    .update(conversa)
    .set(
      comTimestampAtualizacao({
        naoLidas: 0,
        ultimaLeituraEm: new Date(),
      }),
    )
    .where(eq(conversa.id, conversaId));
}
