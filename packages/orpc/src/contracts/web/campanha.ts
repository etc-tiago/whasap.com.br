import { oc } from "@orpc/contract";
import { z } from "zod";

import { organizacaoHashSchema } from "../../schemas";

const campanhaEnvioSchema = z.object({
  id: z.string().uuid(),
  instanciaId: z.string().uuid(),
  usuarioId: z.string().uuid(),
  nomeDestinatario: z.string().nullable(),
  telefone: z.string(),
  corpo: z.string().nullable(),
  templateNome: z.string().nullable(),
  templateIdioma: z.string().nullable(),
  templateVariaveis: z.record(z.string()).nullable(),
  status: z.enum(["enviado", "erro"]),
  erroMensagem: z.string().nullable(),
  conversaId: z.string().uuid().nullable(),
  criadoEm: z.string().datetime(),
});

const campanhaTemplateMemorizadoSchema = z.object({
  id: z.string().uuid(),
  instanciaId: z.string().uuid().nullable(),
  nome: z.string(),
  templateNome: z.string(),
  templateIdioma: z.string(),
  variaveis: z.record(z.string()).nullable(),
  criadoEm: z.string().datetime(),
  atualizadoEm: z.string().datetime(),
});

export const campanhaContract = {
  enviar: oc
    .input(
      z.object({
        organizacaoHash: organizacaoHashSchema,
        instanciaId: z.string().uuid(),
        nome: z.string().min(1).optional(),
        telefone: z.string().min(8),
        corpo: z.string().min(1).optional(),
        templateId: z.string().uuid().optional(),
        variaveis: z.record(z.string()).optional(),
        /** Quando true, o cliente já confirmou o alerta de volume. */
        confirmarAlertaVolume: z.boolean().optional(),
        memorizarTemplate: z
          .object({
            nome: z.string().min(1),
          })
          .optional(),
      }),
    )
    .output(
      z.object({
        conversaId: z.string().uuid(),
        envioId: z.string().uuid(),
        alertaVolume: z.boolean(),
        contagemRecente: z.number().int(),
      }),
    ),

  listaEnvios: oc
    .input(
      z.object({
        organizacaoHash: organizacaoHashSchema,
        pagina: z.number().int().min(1).default(1),
        porPagina: z.number().int().min(1).max(100).default(30),
        status: z.enum(["enviado", "erro"]).optional(),
        instanciaId: z.string().uuid().optional(),
        de: z.string().datetime().optional(),
        ate: z.string().datetime().optional(),
      }),
    )
    .output(
      z.object({
        itens: z.array(campanhaEnvioSchema),
        total: z.number().int(),
      }),
    ),

  resumo: oc
    .input(z.object({ organizacaoHash: organizacaoHashSchema }))
    .output(
      z.object({
        enviadosHoje: z.number().int(),
        enviadosHora: z.number().int(),
        errosHoje: z.number().int(),
        totalHoje: z.number().int(),
      }),
    ),

  templatesMemorizados: {
    lista: oc
      .input(
        z.object({
          organizacaoHash: organizacaoHashSchema,
          instanciaId: z.string().uuid().optional(),
        }),
      )
      .output(z.array(campanhaTemplateMemorizadoSchema)),

    salvar: oc
      .input(
        z.object({
          organizacaoHash: organizacaoHashSchema,
          instanciaId: z.string().uuid().optional(),
          nome: z.string().min(1),
          templateNome: z.string().min(1),
          templateIdioma: z.string().min(1),
          variaveis: z.record(z.string()).optional(),
        }),
      )
      .output(campanhaTemplateMemorizadoSchema),

    remover: oc
      .input(
        z.object({
          organizacaoHash: organizacaoHashSchema,
          id: z.string().uuid(),
        }),
      )
      .output(z.object({ ok: z.boolean() })),
  },
};
