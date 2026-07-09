import { oc } from "@orpc/contract";
import { z } from "zod";

import { instanciaSchema, organizacaoHashSchema, organizacaoSchema } from "../../schemas";

const paginacaoInput = z.object({
  limite: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

export const officeAdministracaoContract = {
  organizacoes: {
    lista: oc.input(paginacaoInput.optional()).output(
      z.object({
        itens: z.array(organizacaoSchema),
        total: z.number().int(),
      }),
    ),

    obter: oc.input(z.object({ organizacaoHash: organizacaoHashSchema })).output(organizacaoSchema),
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

    obter: oc.input(z.object({ instanciaId: z.string().uuid() })).output(instanciaSchema),

    estadoEvolution: oc.input(z.object({ instanciaId: z.string().uuid() })).output(
      z.object({
        instanciaDb: z.object({
          uuid: z.string().uuid(),
          nome: z.string(),
          status: z.string(),
          evolucaoNomeInstancia: z.string().nullable(),
          evolucaoInstanceId: z.string().nullable(),
          conectadoEm: z.string().nullable(),
        }),
        evolution: z.object({
          statusBruto: z.unknown().nullable(),
          qrBruto: z.unknown().nullable(),
          estado: z.string().nullable(),
          erro: z.string().nullable(),
        }),
      }),
    ),
  },

  webhooks: {
    lista: oc
      .input(
        paginacaoInput
          .extend({
            origem: z.enum(["evo", "cloud", "asaas"]).optional(),
            instanciaId: z.string().uuid().optional(),
          })
          .optional(),
      )
      .output(
        z.object({
          itens: z.array(
            z.object({
              id: z.number().int(),
              origem: z.string(),
              idEvento: z.string().nullable(),
              evento: z.string().nullable(),
              instanciaRef: z.string().nullable(),
              processadoEm: z.string().nullable(),
              criadoEm: z.string(),
            }),
          ),
          total: z.number().int(),
        }),
      ),

    obter: oc.input(z.object({ id: z.number().int() })).output(
      z.object({
        id: z.number().int(),
        origem: z.string(),
        idEvento: z.string().nullable(),
        payload: z.unknown(),
        processadoEm: z.string().nullable(),
        criadoEm: z.string(),
        r2Conteudo: z.unknown().nullable(),
      }),
    ),
  },
};
