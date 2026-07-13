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
          evoNomeInstancia: z.string().nullable(),
          evoInstanceId: z.string().nullable(),
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

  acoesEvolution: {
    lista: oc
      .input(
        z.object({
          instanciaId: z.string().uuid(),
          limite: z.number().int().min(1).max(100).optional(),
          cursor: z.string().optional(),
        }),
      )
      .output(
        z.object({
          itens: z.array(
            z.object({
              chave: z.string(),
              tipo: z.string().nullable(),
              tamanho: z.number().int(),
              gravadoEm: z.string(),
            }),
          ),
          total: z.number().int(),
          cursor: z.string().nullable(),
        }),
      ),

    obter: oc.input(z.object({ chave: z.string().min(1) })).output(
      z.object({
        chave: z.string(),
        conteudo: z.unknown(),
      }),
    ),
  },

  webhooks: {
    lista: oc
      .input(
        paginacaoInput
          .extend({
            origem: z.enum(["evo", "cloud"]).optional(),
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
