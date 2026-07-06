import { z } from "zod";

export const turnstileTokenSchema = z.object({
  turnstileToken: z.string().min(1, "Verificação de segurança obrigatória"),
});

export const officeUsuarioSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  nome: z.string(),
});

export const officeSessaoSchema = z.object({
  usuario: officeUsuarioSchema,
});

export const memberRoleSchema = z.enum(["admin", "usuario", "analista"]);
export const instanceProviderSchema = z.enum(["cloud_api", "evolution"]);
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

export const organizacaoSchema = z.object({
  id: z.string().uuid(),
  nome: z.string(),
  slug: z.string(),
  documento: z.string().nullable(),
  tipoDocumento: z.string().nullable(),
  razaoSocial: z.string().nullable(),
  asaasCustomerId: z.string().nullable(),
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
  evolutionSecretName: z.string().nullable(),
  cloudPhoneNumberId: z.string().nullable(),
  trialEndsAt: z.string().datetime().nullable(),
  connectedAt: z.string().datetime().nullable(),
  criadoEm: z.string().datetime(),
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
