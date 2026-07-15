/**
 * Persistência de mensagens inbound/outbound: contato org, vínculo por instância, conversa e mensagem.
 */
import {
  colunasContatoCaixaEntrada,
  colunasContatoInstancia,
  colunasMensagemWebhook,
  colunasSomenteId,
  colunasUsoMensal,
  colunasUsoMensalContato,
  comCriadoEm,
  comTimestampAtualizacao,
  comTimestampsCriacao,
  contato,
  contatoInstancia,
  conversa,
  type Db,
  mensagem,
  usoMensal,
  usoMensalContato,
} from "@whasap/db";
import { and, eq, isNull, sql } from "drizzle-orm";

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
function sqlUltimaMensagemMonotonica(nova: Date) {
  const iso = isoTimestampParaSql(nova);
  const ts = sql`${sql.param(iso)}::timestamp`;
  return sql`CASE
    WHEN ${conversa.ultimaMensagemEm} IS NULL OR ${conversa.ultimaMensagemEm} < ${ts}
    THEN ${ts}
    ELSE ${conversa.ultimaMensagemEm}
  END`;
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
      .returning({ id: contato.id });
    return { id: created!.id };
  } else {
    const updates: Record<string, unknown> = {};
    if (params.contactName && !contact.nome) updates.nome = params.contactName;
    if (params.phone && !contact.telefone) updates.telefone = params.phone;
    if (Object.keys(updates).length > 0) {
      await db
        .update(contato)
        .set(comTimestampAtualizacao(updates as never))
        .where(eq(contato.id, contact.id));
    }
  }

  return { id: contact.id };
}

async function buscarOuCriarContatoInstancia(
  db: Db,
  params: IngerirMensagemParams,
  contatoId: number,
): Promise<void> {
  const existing = await db.query.contatoInstancia.findFirst({
    where: and(
      eq(contatoInstancia.instanciaId, params.instanciaId),
      eq(contatoInstancia.idExterno, params.idExternoLinha),
    ),
    columns: colunasContatoInstancia,
  });
  if (existing) {
    if (existing.contatoId !== contatoId) {
      await db
        .update(contatoInstancia)
        .set(comTimestampAtualizacao({ contatoId }))
        .where(eq(contatoInstancia.id, existing.id));
    }
    return;
  }

  const byContato = await db.query.contatoInstancia.findFirst({
    where: and(
      eq(contatoInstancia.contatoId, contatoId),
      eq(contatoInstancia.instanciaId, params.instanciaId),
    ),
    columns: colunasSomenteId,
  });
  if (byContato) {
    await db
      .update(contatoInstancia)
      .set(comTimestampAtualizacao({ idExterno: params.idExternoLinha }))
      .where(eq(contatoInstancia.id, byContato.id));
    return;
  }

  await db.insert(contatoInstancia).values(
    comTimestampsCriacao({
      contatoId,
      instanciaId: params.instanciaId,
      idExterno: params.idExternoLinha,
    }),
  );
}

async function buscarOuCriarConversa(
  db: Db,
  params: IngerirMensagemParams,
  contactId: number,
): Promise<{ id: number; naoLidas: number }> {
  let conversation = await db.query.conversa.findFirst({
    where: and(
      eq(conversa.instanciaId, params.instanciaId),
      eq(conversa.contatoId, contactId),
      eq(conversa.status, "open"),
      isNull(conversa.excluidoEm),
    ),
    columns: { id: true, naoLidas: true },
  });

  const ultimaEm = params.ultimaMensagemEm ?? params.enviadoEm ?? new Date();
  const isMetaCloud = params.provedor === "meta_cloud";

  if (!conversation) {
    const [created] = await db
      .insert(conversa)
      .values(
        comTimestampsCriacao({
          instanciaId: params.instanciaId,
          contatoId: contactId,
          ultimaMensagemEm: ultimaEm,
          naoLidas: params.naoLidasInicial ?? 0,
          ...(isMetaCloud
            ? { metaCloudJanelaExpiraEm: new Date(Date.now() + 24 * 60 * 60 * 1000) }
            : {}),
        }),
      )
      .returning({ id: conversa.id, naoLidas: conversa.naoLidas });
    return created!;
  }

  const setValues: Record<string, unknown> = {
    ultimaMensagemEm: sqlUltimaMensagemMonotonica(ultimaEm),
    atualizadoEm: new Date(),
  };
  if (isMetaCloud) {
    setValues.metaCloudJanelaExpiraEm = new Date(Date.now() + 24 * 60 * 60 * 1000);
  }
  if (params.naoLidasInicial !== undefined && params.naoLidasInicial > conversation.naoLidas) {
    setValues.naoLidas = params.naoLidasInicial;
  }

  await db
    .update(conversa)
    .set(setValues as never)
    .where(eq(conversa.id, conversation.id));

  return conversation;
}

/**
 * Persiste mensagem: contato org, vínculo instância, conversa, mensagem e uso mensal.
 * Idempotente por `externalId` quando informado — retorna a existente (`created: false`)
 * para permitir backfill de mídia sem recriar a linha.
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

  const [message] = await db
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
    )
    .returning();

  const setValues: Record<string, unknown> = {
    ultimaMensagemEm: sqlUltimaMensagemMonotonica(ultimaEm),
    atualizadoEm: new Date(),
  };
  if (params.naoLidasDelta && params.naoLidasDelta !== 0) {
    const atual = conversation.naoLidas ?? 0;
    setValues.naoLidas = Math.max(0, atual + params.naoLidasDelta);
  }

  await db
    .update(conversa)
    .set(setValues as never)
    .where(eq(conversa.id, conversation.id));

  if (direcao === "inbound") {
    await incrementarUsoMensal(db, params.instanciaId, contact.id);
  }

  return {
    messageId: message!.id,
    conversaId: conversation.id,
    created: true,
    midiaR2Chave: null,
  };
}

async function incrementarUsoMensal(db: Db, instanciaId: number, contatoId: number) {
  const anoMes = new Date().toISOString().slice(0, 7);
  const usageContact = await db.query.usoMensalContato.findFirst({
    where: and(
      eq(usoMensalContato.instanciaId, instanciaId),
      eq(usoMensalContato.contatoId, contatoId),
      eq(usoMensalContato.anoMes, anoMes),
    ),
    columns: colunasUsoMensalContato,
  });
  if (usageContact) return;

  await db.insert(usoMensalContato).values({
    instanciaId,
    contatoId,
    anoMes,
    contadoEm: new Date(),
  });

  const usage = await db.query.usoMensal.findFirst({
    where: and(eq(usoMensal.instanciaId, instanciaId), eq(usoMensal.anoMes, anoMes)),
    columns: colunasUsoMensal,
  });
  if (usage) {
    await db
      .update(usoMensal)
      .set({
        contatosUnicosContagem: usage.contatosUnicosContagem + 1,
        atualizadoEm: new Date(),
      })
      .where(eq(usoMensal.id, usage.id));
  } else {
    await db.insert(usoMensal).values({
      instanciaId,
      anoMes,
      contatosUnicosContagem: 1,
      atualizadoEm: new Date(),
    });
  }
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
  const message = await db.query.mensagem.findFirst({
    where: and(eq(mensagem.idExterno, externalId), isNull(mensagem.excluidoEm)),
    columns: { ...colunasMensagemWebhook, conversaId: true },
  });
  if (!message) return null;

  await db.update(mensagem).set({ status }).where(eq(mensagem.id, message.id));
  return message.conversaId;
}

/** Decrementa não lidas da conversa (floor 0). */
export async function decrementarNaoLidas(db: Db, conversaId: number, quantidade = 1) {
  const row = await db.query.conversa.findFirst({
    where: eq(conversa.id, conversaId),
    columns: { id: true, naoLidas: true },
  });
  if (!row) return;

  await db
    .update(conversa)
    .set(
      comTimestampAtualizacao({
        naoLidas: Math.max(0, (row.naoLidas ?? 0) - quantidade),
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
