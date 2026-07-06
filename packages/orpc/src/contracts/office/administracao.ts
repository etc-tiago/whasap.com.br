import { oc } from "@orpc/contract";
import { z } from "zod";

import { instanciaSchema, organizacaoSchema } from "../../schemas";

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
      .input(z.object({ organizacaoId: z.string().uuid() }))
      .output(organizacaoSchema),
  },

  instancias: {
    lista: oc
      .input(
        paginacaoInput
          .extend({
            organizacaoId: z.string().uuid().optional(),
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
