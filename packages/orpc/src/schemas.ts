import { z } from "zod";

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
  asaasCustomerId: z.string().nullable(),
});

export const estadoDemonstracaoSchema = z.enum(["livre", "aviso", "bloqueado", "pago"]);

export const demonstracaoSchema = z.object({
  estado: estadoDemonstracaoSchema,
  diasRestantes: z.number().int().nullable(),
  demonstracaoIniciaEm: z.string().datetime().nullable(),
});

export const organizacaoComPapelSchema = organizacaoSchema.extend({
  meuPapel: memberRoleSchema,
  demonstracao: demonstracaoSchema,
});

export const organizacaoMembroSchema = z.object({
  id: z.string().uuid(),
  organizacaoId: z.string().uuid(),
  usuarioId: z.string().uuid(),
  usuarioNome: z.string().optional(),
  usuarioEmail: z.string().email().optional(),
  role: memberRoleSchema,
});

export const instanciaSchema = z.object({
  id: z.string().uuid(),
  organizacaoId: z.string().uuid(),
  nome: z.string(),
  provider: instanceProviderSchema,
  status: instanceStatusSchema,
  limiteConversas: z.number().int(),
  asaasSubscriptionId: z.string().nullable(),
  cloudPhoneNumberId: z.string().nullable(),
  trialEndsAt: z.string().datetime().nullable(),
  connectedAt: z.string().datetime().nullable(),
  criadoEm: z.string().datetime(),
  evoHistoricoSincronizadoEm: z.string().datetime().nullable().optional(),
  evoHistoricoSincronizandoEm: z.string().datetime().nullable().optional(),
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

export const sessaoSchema = z.object({
  usuario: usuarioSchema,
  organizacao: organizacaoSchema.nullable(),
  role: memberRoleSchema.nullable(),
});
