import { notFound } from "@whasap/api-core";

import { toOrganizacaoOutput } from "../../../lib/mappers";
import { os } from "../../../lib/os";
import { requireOfficeAuth } from "../../../handlers/auth-session";

export default os.administracao.organizacoes.obter.handler(async ({ context, input }) => {
  requireOfficeAuth(context);
  const org = await context.client.organizations.findFirst({
    where: { uuid: input.organizacaoId },
  });
  if (!org) notFound();
  return toOrganizacaoOutput(org);
});
