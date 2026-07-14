import { z } from "zod";

import { ICONES_CONEXAO } from "@whasap/config";

export const officeUsuarioSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  nome: z.string(),
});

export const officeSessaoSchema = z.object({
  usuario: officeUsuarioSchema,
});

export const memberRoleSchema = z.enum(["admin", "usuario", "analista"]);
export const instanceProviderSchema = z.enum(["meta_cloud", "evo"]);
export const instanceStatusSchema = z.enum([
  "pending_connection",
  "pending_payment",
  "provisioning",
  "disconnected",
  "connected",
  "deactivated",
]);

export const iconeConexaoSchema = z.enum(ICONES_CONEXAO);

export const usuarioSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  nome: z.string(),
  emailVerificadoEm: z.string().datetime().nullable(),
});

export const organizacaoHashSchema = z.string().uuid();

export const organizacaoSchema = z.object({
  id: z.string().uuid(),
  nome: z.string(),
  slug: z.string(),
  documento: z.string().nullable(),
  tipoDocumento: z.string().nullable(),
  razaoSocial: z.string().nullable(),
  telefoneWhatsapp: z.string().nullable(),
  aceiteAdesaoEm: z.string().datetime().nullable(),
  aceiteAdesaoVersao: z.string().nullable(),
  /** Horas sem mensagem antes do auto-fechar (texto numérico, default "72"). */
  horasAutoFecharInatividade: z.string(),
  /** Prefixa o nome do atendente nas mensagens outbound do WhatsApp. */
  exibirNomeAtendenteMensagens: z.boolean(),
});

export const organizacaoComPapelSchema = organizacaoSchema.extend({
  meuPapel: memberRoleSchema,
});

export const organizacaoMembroSchema = z.object({
  id: z.string().uuid(),
  organizacaoId: z.string().uuid(),
  usuarioId: z.string().uuid(),
  usuarioNome: z.string().optional(),
  usuarioEmail: z.string().email().optional(),
  role: memberRoleSchema,
  ultimaAtividadeEm: z.string().datetime().nullable(),
  ultimaMensagemEnviadaEm: z.string().datetime().nullable(),
});

export const instanciaSchema = z.object({
  id: z.string().uuid(),
  organizacaoId: z.string().uuid(),
  nome: z.string(),
  icone: iconeConexaoSchema,
  provider: instanceProviderSchema,
  status: instanceStatusSchema,
  limiteConversas: z.number().int(),
  cloudPhoneNumberId: z.string().nullable(),
  connectedAt: z.string().datetime().nullable(),
  /** Cleanup liberou a sessão Evolution; painel mantém a row para reconectar. */
  sessaoRemotaLiberadaEm: z.string().datetime().nullable(),
  criadoEm: z.string().datetime(),
  evoHistoricoSincronizadoEm: z.string().datetime().nullable().optional(),
  evoHistoricoSincronizandoEm: z.string().datetime().nullable().optional(),
  evoHistoricoSyncStatus: z
    .enum(["idle", "requested", "running", "completed", "failed"])
    .optional(),
  evoHistoricoSyncProgress: z.number().int().nullable().optional(),
  evoHistoricoSyncErro: z.string().nullable().optional(),
});

export const messageTypeSchema = z.enum([
  "text",
  "image",
  "audio",
  "video",
  "document",
  "sticker",
  "location",
  "contacts",
  "template",
  "interactive",
  "button",
  "list",
  "carousel",
  "poll",
  "link",
  "reaction",
]);

const enviarMensagemBase = z.object({
  conversaId: z.string().uuid(),
});

const quotedFields = {
  contextoMensagemId: z.string().optional(),
};

export const enviarMensagemTextoSchema = enviarMensagemBase.extend({
  tipo: z.literal("text"),
  body: z.string().min(1),
  ...quotedFields,
});

export const enviarMensagemMidiaSchema = enviarMensagemBase.extend({
  tipo: z.enum(["image", "audio", "video", "document", "sticker"]),
  mediaUrl: z.string().url().optional(),
  body: z.string().optional(),
  mediaR2Key: z.string().min(1).optional(),
  filename: z.string().optional(),
  voice: z.boolean().optional(),
  ...quotedFields,
});

export const enviarMensagemLocalizacaoSchema = enviarMensagemBase.extend({
  tipo: z.literal("location"),
  latitude: z.number(),
  longitude: z.number(),
  localNome: z.string().optional(),
  localEndereco: z.string().optional(),
  ...quotedFields,
});

export const enviarMensagemContatosSchema = enviarMensagemBase.extend({
  tipo: z.literal("contacts"),
  contatos: z.array(z.unknown()).min(1),
  ...quotedFields,
});

export const enviarMensagemInteractiveSchema = enviarMensagemBase.extend({
  tipo: z.literal("interactive"),
  interactive: z.unknown(),
  ...quotedFields,
});

export const enviarMensagemReacaoSchema = enviarMensagemBase.extend({
  tipo: z.literal("reaction"),
  mensagemIdExterno: z.string().min(1),
  emoji: z.string(),
});

export const enviarMensagemPayloadSchema = enviarMensagemBase.extend({
  tipo: z.enum(["button", "list", "carousel", "poll", "link"]),
  payload: z.unknown(),
  ...quotedFields,
});

export const enviarMensagemInputSchema = z.discriminatedUnion("tipo", [
  enviarMensagemTextoSchema,
  enviarMensagemMidiaSchema,
  enviarMensagemLocalizacaoSchema,
  enviarMensagemContatosSchema,
  enviarMensagemInteractiveSchema,
  enviarMensagemReacaoSchema,
  enviarMensagemPayloadSchema,
]);

export const messageTemplateSchema = z.object({
  id: z.string().uuid(),
  nome: z.string(),
  idioma: z.string(),
  categoria: z.string().nullable(),
  status: z.string(),
  componentes: z.unknown().nullable(),
});

export const respostaRapidaItemTipoSchema = z.enum(["text", "image", "document"]);

export const respostaRapidaItemSchema = z.object({
  id: z.string().uuid(),
  ordem: z.number().int().nonnegative(),
  tipo: respostaRapidaItemTipoSchema,
  corpo: z.string().nullable(),
  mediaR2Key: z.string().nullable(),
  mediaUrl: z.string().url().nullable(),
  nomeArquivo: z.string().nullable(),
});

export const respostaRapidaItemInputSchema = z
  .object({
    tipo: respostaRapidaItemTipoSchema,
    corpo: z.string().trim().max(4096).nullable().optional(),
    mediaR2Key: z.string().min(1).nullable().optional(),
    nomeArquivo: z.string().trim().max(255).nullable().optional(),
  })
  .superRefine((item, ctx) => {
    if (item.tipo === "text") {
      if (!item.corpo?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Texto obrigatório",
          path: ["corpo"],
        });
      }
    } else if (!item.mediaR2Key?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Mídia obrigatória",
        path: ["mediaR2Key"],
      });
    }
  });

export const respostaRapidaListaItemSchema = z.object({
  id: z.string().uuid(),
  titulo: z.string(),
  quantidadeItens: z.number().int().nonnegative(),
  preview: z.string().nullable(),
  tipos: z.array(respostaRapidaItemTipoSchema),
  criadoEm: z.string().datetime(),
  atualizadoEm: z.string().datetime(),
});

export const respostaRapidaDetalheSchema = z.object({
  id: z.string().uuid(),
  titulo: z.string(),
  itens: z.array(respostaRapidaItemSchema),
  criadoEm: z.string().datetime(),
  atualizadoEm: z.string().datetime(),
});

export const sessaoSchema = z.object({
  usuario: usuarioSchema,
  organizacao: organizacaoSchema.nullable(),
  role: memberRoleSchema.nullable(),
});
