import { organizacao } from "@whasap/db";
import { count } from "drizzle-orm";

import { toOrganizacaoOutput } from "../../../lib/mappers";
import { os } from "../../../lib/os";
import { requireOfficeAuth } from "../../../handlers/auth-session";

export default os.administracao.organizacoes.lista.handler(async ({ context, input }) => {
  requireOfficeAuth(context);
  const limite = input?.limite ?? 50;
  const offset = input?.offset ?? 0;

  const [totalRow] = await context.db.select({ value: count() }).from(organizacao);
  const rows = await context.client.organizacao.findMany({
    take: limite,
    skip: offset,
  });

  return {
    itens: rows.map(toOrganizacaoOutput),
    total: totalRow?.value ?? 0,
  };
});
