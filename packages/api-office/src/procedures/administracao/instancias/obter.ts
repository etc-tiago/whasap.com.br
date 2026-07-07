import { notFound } from "@whasap/api-core";

import { toInstanciaOutput } from "../../../lib/mappers";
import { os } from "../../../lib/os";
import { requireOfficeAuth } from "../../../handlers/auth-session";

export default os.administracao.instancias.obter.handler(async ({ context, input }) => {
  requireOfficeAuth(context);
  const row = await context.client.instancia.findFirst({
    where: { uuid: input.instanciaId },
    include: { organizacao: true },
  });
  if (!row?.organizacao) notFound();
  return toInstanciaOutput(row, row.organizacao.uuid);
});
