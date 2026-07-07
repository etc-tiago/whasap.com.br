import { oc } from "@orpc/contract";
import { z } from "zod";

import { instanciaSchema, organizacaoHashSchema, organizacaoSchema } from "../../schemas";

const paginacaoInput = z.object({
  limite: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

export const officeAdministracaoContract = {
  organizacoes: {
    lista: oc
      .input(paginacaoInput.optional())
      .output(
        z.object({
          itens: z.array(organizacaoSchema),
          total: z.number().int(),
        }),
      ),

    obter: oc
      .input(z.object({ organizacaoHash: organizacaoHashSchema }))
      .output(organizacaoSchema),
  },

  instancias: {
    lista: oc
      .input(
        paginacaoInput
          .extend({
            organizacaoHash: organizacaoHashSchema.optional(),
          })
          .optional(),
      )
      .output(
        z.object({
          itens: z.array(instanciaSchema),
          total: z.number().int(),
        }),
      ),

    obter: oc
      .input(z.object({ instanciaId: z.string().uuid() }))
      .output(instanciaSchema),
  },
};
