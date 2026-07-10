import { oc } from "@orpc/contract";
import { z } from "zod";

import { instanciaSchema, instanceProviderSchema, organizacaoHashSchema } from "../../schemas";

const evolutionDebugSchema = z
  .object({
    statusBruto: z.unknown().optional(),
    qrBruto: z.unknown().optional(),
    erro: z.string().optional(),
    statusHttp: z.number().optional(),
  })
  .optional();

export const instanciaContract = {
  lista: oc
    .input(z.object({ organizacaoHash: organizacaoHashSchema }))
    .output(z.array(instanciaSchema)),

  criar: oc
    .input(
      z.object({
        organizacaoHash: organizacaoHashSchema,
        nome: z.string().min(2),
        provider: instanceProviderSchema,
      }),
    )
    .output(instanciaSchema),

  provisionar: oc
    .input(z.object({ instanciaId: z.string().uuid() }))
    .output(z.object({ ok: z.boolean() })),

  encerrarPareamento: oc
    .input(z.object({ instanciaId: z.string().uuid() }))
    .output(z.object({ ok: z.boolean() })),

  descartar: oc
    .input(z.object({ instanciaId: z.string().uuid() }))
    .output(z.object({ ok: z.boolean() })),

  obterQr: oc.input(z.object({ instanciaId: z.string().uuid() })).output(
    z.object({
      base64: z.string().nullable(),
      pairingCode: z.string().nullable(),
      estado: z.string(),
      _debug: evolutionDebugSchema,
    }),
  ),

  statusConexao: oc
    .input(z.object({ instanciaId: z.string().uuid() }))
    .output(
      z.object({
        estado: z.string(),
        conectado: z.boolean(),
        _debug: evolutionDebugSchema,
      }),
    ),

  configurarCloud: oc
    .input(
      z.object({
        instanciaId: z.string().uuid(),
        phoneNumberId: z.string().min(1),
        wabaId: z.string().min(1),
        accessToken: z.string().min(1),
      }),
    )
    .output(z.object({ ok: z.boolean(), templatesCount: z.number().int() })),

  criarCheckout: oc
    .input(
      z.object({
        instanciaId: z.string().uuid(),
        documento: z.string().min(11),
        tipoDocumento: z.enum(["cpf", "cnpj"]),
        razaoSocial: z.string().min(2),
      }),
    )
    .output(z.object({ urlCheckout: z.string().url() })),

  obter: oc.input(z.object({ instanciaId: z.string().uuid() })).output(instanciaSchema),

  sincronizarHistorico: oc
    .input(z.object({ instanciaId: z.string().uuid() }))
    .output(z.object({ ok: z.boolean() })),

  adicionarPacoteConversas: oc
    .input(z.object({ instanciaId: z.string().uuid() }))
    .output(z.object({ urlCheckout: z.string().url() })),
};
