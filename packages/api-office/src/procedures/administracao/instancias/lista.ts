import { notFound } from "@whasap/api-core";
import { instancia } from "@whasap/db";
import { count, eq } from "drizzle-orm";

import { requireOfficeAuth } from "../../../handlers/auth-session";
import { toInstanciaOutput } from "../../../lib/mappers";
import { os } from "../../../lib/os";

export default os.administracao.instancias.lista.handler(async ({ context, input }) => {
  requireOfficeAuth(context);
  const limite = input?.limite ?? 50;
  const offset = input?.offset ?? 0;

  let orgInternalId: number | undefined;
  if (input?.organizacaoHash) {
    const org = await context.client.organizacao.findFirst({
      where: { uuid: input.organizacaoHash },
      select: { id: true },
    });
    if (!org) notFound();
    orgInternalId = org.id;
  }

  const rows = orgInternalId
    ? await context.client.instancia.findMany({
      where: { organizacaoId: orgInternalId },
      include: { organizacao: true },
      take: limite,
      skip: offset,
    })
    : await context.client.instancia.findMany({
      include: { organizacao: true },
      take: limite,
      skip: offset,
    });

  const [totalRow] = orgInternalId
    ? await context.db
      .select({ value: count() })
      .from(instancia)
      .where(eq(instancia.organizacaoId, orgInternalId))
    : await context.db.select({ value: count() }).from(instancia);

  return {
    itens: rows.map((r) => toInstanciaOutput(r, r.organizacao!.uuid)),
    total: totalRow?.value ?? 0,
  };
});
