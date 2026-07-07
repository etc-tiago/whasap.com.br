import { oc } from "@orpc/contract";
import { z } from "zod";

import { organizacaoHashSchema } from "../../schemas";

const cobrancaPendenteSchema = z.object({
  id: z.string(),
  valor: z.number(),
  vencimento: z.string(),
  urlFatura: z.string().url().nullable(),
  status: z.string(),
});

export const cobrancaContract = {
  assinaturas: oc.input(z.object({ organizacaoHash: organizacaoHashSchema })).output(
    z.object({
      assinaturas: z.array(
        z.object({
          instanciaId: z.string().uuid(),
          instanciaNome: z.string(),
          asaasSubscriptionId: z.string(),
          statusInstancia: z.string(),
          statusAssinatura: z.string(),
          cobrancasPendentes: z.array(cobrancaPendenteSchema),
        }),
      ),
    }),
  ),

  cancelarAssinatura: oc
    .input(z.object({ instanciaId: z.string().uuid() }))
    .output(z.object({ ok: z.boolean() })),

  uso: oc.input(z.object({ instanciaId: z.string().uuid() })).output(
    z.object({
      anoMes: z.string(),
      contatosUnicos: z.number().int(),
      limiteConversas: z.number().int(),
      nivelAlerta: z.enum(["ok", "warn80", "warn90", "blocked"]).nullable(),
    }),
  ),
};
