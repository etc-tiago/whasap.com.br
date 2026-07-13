import { oc } from "@orpc/contract";
import { z } from "zod";

import { organizacaoHashSchema } from "../../schemas";

const escopoOrgSchema = z.object({
  organizacaoHash: organizacaoHashSchema,
  instanciaId: z.string().uuid().optional(),
});

const afetadasSchema = z.object({
  afetadas: z.number().int().nonnegative(),
});

const resumoSchema = z.object({
  abertas: z.number().int().nonnegative(),
  semDono: z.number().int().nonnegative(),
  comNaoLidas: z.number().int().nonnegative(),
  inativas: z.number().int().nonnegative(),
  minhasAtribuidas: z.number().int().nonnegative(),
  horasAutoFecharInatividade: z.string(),
});

export const acoesContract = {
  resumo: oc.input(escopoOrgSchema).output(resumoSchema),

  finalizarTodas: oc.input(escopoOrgSchema).output(afetadasSchema),

  finalizarInativas: oc.input(escopoOrgSchema).output(afetadasSchema),

  marcarTodasLidas: oc.input(escopoOrgSchema).output(afetadasSchema),

  distribuirSemDono: oc.input(escopoOrgSchema).output(afetadasSchema),

  assumirSemDono: oc.input(escopoOrgSchema).output(afetadasSchema),

  liberarMinhas: oc.input(escopoOrgSchema).output(afetadasSchema),

  aplicarEtiquetaAbertas: oc
    .input(
      escopoOrgSchema.extend({
        etiquetaId: z.string().uuid(),
      }),
    )
    .output(afetadasSchema),
};
