import { oc } from "@orpc/contract";
import { z } from "zod";

import { organizacaoHashSchema } from "../../schemas";

export const relatoriosContract = {
  visaoGeral: oc
    .input(
      z.object({
        organizacaoHash: organizacaoHashSchema,
        de: z.string().datetime(),
        ate: z.string().datetime(),
        instanciaId: z.string().uuid().optional(),
      }),
    )
    .output(
      z.object({
        totalConversas: z.number().int(),
        conversasAbertas: z.number().int(),
        conversasFechadas: z.number().int(),
        mensagensEnviadas: z.number().int(),
        mensagensRecebidas: z.number().int(),
        tempoMedioPrimeiraRespostaMinutos: z.number().nullable(),
        porAgente: z.array(
          z.object({
            usuarioId: z.string().uuid(),
            nome: z.string(),
            conversasAtribuidas: z.number().int(),
            mensagensEnviadas: z.number().int(),
          }),
        ),
        porInstancia: z.array(
          z.object({
            instanciaId: z.string().uuid(),
            nome: z.string(),
            conversas: z.number().int(),
          }),
        ),
      }),
    ),
};
