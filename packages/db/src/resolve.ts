import type { Client } from "./client";
import {
  contacts,
  conversations,
  instances,
  organizationInvites,
  organizationMembers,
  organizations,
  usuario,
} from "./schema";

export type ExportableTableName =
  | "usuario"
  | "organizations"
  | "organizationMembers"
  | "organizationInvites"
  | "instances"
  | "contacts"
  | "conversations";

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
    case "organizations": {
      const row = await client.organizations.findFirst({ where: { uuid: publicUuid }, select });
      return row?.id ?? null;
    }
    case "organizationMembers": {
      const row = await client.organizationMembers.findFirst({
        where: { uuid: publicUuid },
        select,
      });
      return row?.id ?? null;
    }
    case "organizationInvites": {
      const row = await client.organizationInvites.findFirst({
        where: { uuid: publicUuid },
        select,
      });
      return row?.id ?? null;
    }
    case "instances": {
      const row = await client.instances.findFirst({ where: { uuid: publicUuid }, select });
      return row?.id ?? null;
    }
    case "contacts": {
      const row = await client.contacts.findFirst({ where: { uuid: publicUuid }, select });
      return row?.id ?? null;
    }
    case "conversations": {
      const row = await client.conversations.findFirst({ where: { uuid: publicUuid }, select });
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
    case "organizations": {
      const rows = await client.organizations.findMany({ where: { uuid: { in: unique } }, select });
      return new Map(rows.map((row) => [row.uuid, row.id]));
    }
    case "organizationMembers": {
      const rows = await client.organizationMembers.findMany({
        where: { uuid: { in: unique } },
        select,
      });
      return new Map(rows.map((row) => [row.uuid, row.id]));
    }
    case "organizationInvites": {
      const rows = await client.organizationInvites.findMany({
        where: { uuid: { in: unique } },
        select,
      });
      return new Map(rows.map((row) => [row.uuid, row.id]));
    }
    case "instances": {
      const rows = await client.instances.findMany({ where: { uuid: { in: unique } }, select });
      return new Map(rows.map((row) => [row.uuid, row.id]));
    }
    case "contacts": {
      const rows = await client.contacts.findMany({ where: { uuid: { in: unique } }, select });
      return new Map(rows.map((row) => [row.uuid, row.id]));
    }
    case "conversations": {
      const rows = await client.conversations.findMany({ where: { uuid: { in: unique } }, select });
      return new Map(rows.map((row) => [row.uuid, row.id]));
    }
  }
}

export function exportUuid(row: { uuid: string }): string {
  return row.uuid;
}

export {
  contacts,
  conversations,
  instances,
  organizationInvites,
  organizationMembers,
  organizations,
  usuario,
};
