import { oc } from "@orpc/contract";
import { z } from "zod";

import {
  enviarMensagemInputSchema,
  messageTemplateSchema,
  organizacaoHashSchema,
} from "../../schemas";

const etiquetaSchema = z.object({
  id: z.string().uuid(),
  nome: z.string(),
  cor: z.string().nullable(),
});

const conversaSchema = z.object({
  id: z.string().uuid(),
  instanciaId: z.string().uuid(),
  instanciaNome: z.string(),
  contatoId: z.string().uuid(),
  contatoNome: z.string().nullable(),
  contatoTelefone: z.string(),
  usuarioAtribuidoId: z.string().uuid().nullable(),
  usuarioAtribuidoNome: z.string().nullable(),
  status: z.string(),
  metaCloudJanelaExpiraEm: z.string().datetime().nullable(),
  ultimaMensagemEm: z.string().datetime().nullable(),
  ultimaMensagemTipo: z.string().nullable().optional(),
  ultimaMensagemPreview: z.string().nullable(),
  naoLidas: z.number().int().nonnegative(),
  etiquetas: z.array(etiquetaSchema),
});

const mensagemSchema = z.object({
  id: z.string().uuid(),
  idExterno: z.string().nullable(),
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
      .input(
        z.object({
          organizacaoHash: organizacaoHashSchema,
          instanciaId: z.string().uuid().optional(),
        }),
      )
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
    lista: oc.input(z.object({ conversaId: z.string().uuid() })).output(z.array(mensagemSchema)),

    enviar: oc.input(enviarMensagemInputSchema).output(mensagemSchema),

    enviarTemplate: oc
      .input(
        z.object({
          conversaId: z.string().uuid(),
          templateId: z.string().uuid(),
          variaveis: z.record(z.string()).optional(),
        }),
      )
      .output(mensagemSchema),

    marcarLido: oc
      .input(
        z.object({
          conversaId: z.string().uuid(),
          mensagemIdExterno: z.string().min(1),
        }),
      )
      .output(z.object({ ok: z.boolean() })),
  },

  midia: {
    upload: oc
      .input(
        z.object({
          conversaId: z.string().uuid(),
          tipo: z.enum(["image", "audio", "video", "document"]),
          nomeArquivo: z.string().min(1),
          tipoConteudo: z.string().min(1),
          dados: z.string().min(1),
        }),
      )
      .output(
        z.object({
          mediaR2Key: z.string(),
          mediaUrl: z.string().url(),
        }),
      ),
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
    lista: oc.input(z.object({ conversaId: z.string().uuid() })).output(
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

  etiquetas: {
    lista: oc
      .input(z.object({ organizacaoHash: organizacaoHashSchema }))
      .output(z.array(etiquetaSchema)),

    porContato: oc
      .input(z.object({ contatoId: z.string().uuid() }))
      .output(z.array(etiquetaSchema)),

    atribuir: oc
      .input(
        z.object({
          contatoId: z.string().uuid(),
          etiquetaId: z.string().uuid(),
        }),
      )
      .output(z.object({ ok: z.boolean() })),

    remover: oc
      .input(
        z.object({
          contatoId: z.string().uuid(),
          etiquetaId: z.string().uuid(),
        }),
      )
      .output(z.object({ ok: z.boolean() })),

    criar: oc
      .input(
        z.object({
          organizacaoHash: organizacaoHashSchema,
          nome: z.string().trim().min(1).max(100),
          cor: z.string().nullable().optional(),
          contatoId: z.string().uuid().optional(),
          instanciaId: z.string().uuid().optional(),
        }),
      )
      .output(etiquetaSchema),
  },

  contatos: {
    atualizarNome: oc
      .input(
        z.object({
          contatoId: z.string().uuid(),
          nome: z.string().max(200),
        }),
      )
      .output(
        z.object({
          ok: z.boolean(),
          nome: z.string().nullable(),
        }),
      ),
  },
};
