import { oc } from "@orpc/contract";
import { z } from "zod";

import { messageTemplateSchema, messageTypeSchema } from "../../schemas";

const conversaSchema = z.object({
  id: z.string().uuid(),
  instanciaId: z.string().uuid(),
  contatoId: z.string().uuid(),
  contatoNome: z.string().nullable(),
  contatoTelefone: z.string(),
  usuarioAtribuidoId: z.string().uuid().nullable(),
  usuarioAtribuidoNome: z.string().nullable(),
  status: z.string(),
  janelaCloudExpiraEm: z.string().datetime().nullable(),
  ultimaMensagemEm: z.string().datetime().nullable(),
  ultimaMensagemPreview: z.string().nullable(),
});

const mensagemSchema = z.object({
  id: z.string().uuid(),
  direction: z.enum(["inbound", "outbound"]),
  type: z.string(),
  body: z.string().nullable(),
  mediaUrl: z.string().url().nullable(),
  enviadoPorUsuarioId: z.string().uuid().nullable(),
  enviadoPorNome: z.string().nullable(),
  templateNome: z.string().nullable(),
  statusEntrega: z.string(),
  criadoEm: z.string().datetime(),
});

export const caixaEntradaContract = {
  conversas: {
    lista: oc
      .input(z.object({ instanciaId: z.string().uuid() }))
      .output(z.array(conversaSchema)),

    iniciar: oc
      .input(
        z.object({
          instanciaId: z.string().uuid(),
          telefone: z.string().min(8),
          nome: z.string().optional(),
          corpo: z.string().optional(),
          templateId: z.string().uuid().optional(),
          variaveis: z.record(z.string()).optional(),
        }),
      )
      .output(z.object({ conversaId: z.string().uuid() })),

    atribuir: oc
      .input(
        z.object({
          conversaId: z.string().uuid(),
          usuarioId: z.string().uuid().nullable(),
        }),
      )
      .output(z.object({ ok: z.boolean() })),

    fechar: oc
      .input(z.object({ conversaId: z.string().uuid() }))
      .output(z.object({ ok: z.boolean() })),
  },

  mensagens: {
    lista: oc
      .input(z.object({ conversaId: z.string().uuid() }))
      .output(z.array(mensagemSchema)),

    enviar: oc
      .input(
        z.object({
          conversaId: z.string().uuid(),
          body: z.string().min(1).optional(),
          tipo: messageTypeSchema.default("text"),
          mediaUrl: z.string().url().optional(),
          mediaR2Key: z.string().optional(),
          latitude: z.number().optional(),
          longitude: z.number().optional(),
          localNome: z.string().optional(),
          localEndereco: z.string().optional(),
        }),
      )
      .output(mensagemSchema),

    enviarTemplate: oc
      .input(
        z.object({
          conversaId: z.string().uuid(),
          templateId: z.string().uuid(),
          variaveis: z.record(z.string()).optional(),
        }),
      )
      .output(mensagemSchema),
  },

  templates: {
    lista: oc
      .input(z.object({ instanciaId: z.string().uuid() }))
      .output(z.array(messageTemplateSchema)),

    sincronizar: oc
      .input(z.object({ instanciaId: z.string().uuid() }))
      .output(z.object({ sincronizados: z.number() })),
  },

  anotacoes: {
    lista: oc
      .input(z.object({ conversaId: z.string().uuid() }))
      .output(
        z.array(
          z.object({
            id: z.string().uuid(),
            body: z.string(),
            autorUsuarioId: z.string().uuid(),
            autorNome: z.string(),
            criadoEm: z.string().datetime(),
          }),
        ),
      ),

    criar: oc
      .input(
        z.object({
          conversaId: z.string().uuid(),
          body: z.string().min(1),
        }),
      )
      .output(z.object({ id: z.string().uuid() })),
  },
};
