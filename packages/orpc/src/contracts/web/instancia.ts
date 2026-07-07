import { oc } from "@orpc/contract";
import { z } from "zod";

import { instanciaSchema, instanceProviderSchema, organizacaoHashSchema } from "../../schemas";

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

  obterQr: oc.input(z.object({ instanciaId: z.string().uuid() })).output(
    z.object({
      base64: z.string().nullable(),
      pairingCode: z.string().nullable(),
      estado: z.string(),
    }),
  ),

  statusConexao: oc
    .input(z.object({ instanciaId: z.string().uuid() }))
    .output(z.object({ estado: z.string(), conectado: z.boolean() })),

  configurarCloud: oc
    .input(
      z.object({
        instanciaId: z.string().uuid(),
        phoneNumberId: z.string().min(1),
        wabaId: z.string().min(1),
        accessToken: z.string().min(1),
      }),
    )
    .output(z.object({ ok: z.boolean() })),

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

  adicionarPacoteConversas: oc
    .input(z.object({ instanciaId: z.string().uuid() }))
    .output(z.object({ urlCheckout: z.string().url() })),
};
