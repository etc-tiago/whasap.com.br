import { notFound } from "@whasap/api-core";
import { instances } from "@whasap/db";
import { count, eq } from "drizzle-orm";

import { requireOfficeAuth } from "../../../handlers/auth-session";
import { toInstanciaOutput } from "../../../lib/mappers";
import { os } from "../../../lib/os";

export default os.administracao.instancias.lista.handler(async ({ context, input }) => {
  requireOfficeAuth(context);
  const limite = input?.limite ?? 50;
  const offset = input?.offset ?? 0;

  let orgInternalId: number | undefined;
  if (input?.organizacaoId) {
    const org = await context.client.organizations.findFirst({
      where: { uuid: input.organizacaoId },
      select: { id: true },
    });
    if (!org) notFound();
    orgInternalId = org.id;
  }

  const rows = orgInternalId
    ? await context.client.instances.findMany({
      where: { organizationId: orgInternalId },
      include: { organization: true },
      take: limite,
      skip: offset,
    })
    : await context.client.instances.findMany({
      include: { organization: true },
      take: limite,
      skip: offset,
    });

  const [totalRow] = orgInternalId
    ? await context.db
      .select({ value: count() })
      .from(instances)
      .where(eq(instances.organizationId, orgInternalId))
    : await context.db.select({ value: count() }).from(instances);

  return {
    itens: rows.map((r) => toInstanciaOutput(r, r.organization!.uuid)),
    total: totalRow?.value ?? 0,
  };
});
