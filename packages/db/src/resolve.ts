import type { Client } from "./client";
import {
  contato,
  conversa,
  instancia,
  organizacao,
  organizacaoConvite,
  organizacaoMembro,
  usuario,
} from "./schema";

export type ExportableTableName =
  | "usuario"
  | "organizacao"
  | "organizacaoMembro"
  | "organizacaoConvite"
  | "instancia"
  | "contato"
  | "conversa";

export async function resolveInternalId(
  client: Client,
  table: ExportableTableName,
  publicUuid: string,
): Promise<number | null> {
  const select = { id: true } as const;

  switch (table) {
    case "usuario": {
      const row = await client.usuario.findFirst({ where: { uuid: publicUuid }, select });
      return row?.id ?? null;
    }
    case "organizacao": {
      const row = await client.organizacao.findFirst({ where: { uuid: publicUuid }, select });
      return row?.id ?? null;
    }
    case "organizacaoMembro": {
      const row = await client.organizacaoMembro.findFirst({
        where: { uuid: publicUuid },
        select,
      });
      return row?.id ?? null;
    }
    case "organizacaoConvite": {
      const row = await client.organizacaoConvite.findFirst({
        where: { uuid: publicUuid },
        select,
      });
      return row?.id ?? null;
    }
    case "instancia": {
      const row = await client.instancia.findFirst({ where: { uuid: publicUuid }, select });
      return row?.id ?? null;
    }
    case "contato": {
      const row = await client.contato.findFirst({ where: { uuid: publicUuid }, select });
      return row?.id ?? null;
    }
    case "conversa": {
      const row = await client.conversa.findFirst({ where: { uuid: publicUuid }, select });
      return row?.id ?? null;
    }
  }
}

export async function resolveInternalIds(
  client: Client,
  table: ExportableTableName,
  publicUuids: string[],
): Promise<Map<string, number>> {
  if (publicUuids.length === 0) return new Map();

  const unique = [...new Set(publicUuids)];
  const select = { id: true, uuid: true } as const;

  switch (table) {
    case "usuario": {
      const rows = await client.usuario.findMany({ where: { uuid: { in: unique } }, select });
      return new Map(rows.map((row) => [row.uuid, row.id]));
    }
    case "organizacao": {
      const rows = await client.organizacao.findMany({ where: { uuid: { in: unique } }, select });
      return new Map(rows.map((row) => [row.uuid, row.id]));
    }
    case "organizacaoMembro": {
      const rows = await client.organizacaoMembro.findMany({
        where: { uuid: { in: unique } },
        select,
      });
      return new Map(rows.map((row) => [row.uuid, row.id]));
    }
    case "organizacaoConvite": {
      const rows = await client.organizacaoConvite.findMany({
        where: { uuid: { in: unique } },
        select,
      });
      return new Map(rows.map((row) => [row.uuid, row.id]));
    }
    case "instancia": {
      const rows = await client.instancia.findMany({ where: { uuid: { in: unique } }, select });
      return new Map(rows.map((row) => [row.uuid, row.id]));
    }
    case "contato": {
      const rows = await client.contato.findMany({ where: { uuid: { in: unique } }, select });
      return new Map(rows.map((row) => [row.uuid, row.id]));
    }
    case "conversa": {
      const rows = await client.conversa.findMany({ where: { uuid: { in: unique } }, select });
      return new Map(rows.map((row) => [row.uuid, row.id]));
    }
  }
}

export function exportUuid(row: { uuid: string }): string {
  return row.uuid;
}

export {
  contato,
  conversa,
  instancia,
  organizacao,
  organizacaoConvite,
  organizacaoMembro,
  usuario,
};
