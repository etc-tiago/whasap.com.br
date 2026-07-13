/**
 * MVP defaults for open product questions (plan 2026-07).
 * Override via env or future admin config where noted.
 */
export const mvpDefaults = {
  billing: {
    currency: "brl" as const,
    /** Taxa base mensal da organização (inclui `conversationsIncludedBase`). */
    orgBasePriceCents: 12_990,
    /** Assinatura mensal por conexão WhatsApp adicional à base. */
    connectionPriceCents: 2_000,
    /**
     * @deprecated Preferir `connectionPriceCents`. Mantido como alias para compat.
     */
    instancePriceCents: 2_000,
    conversationPackPriceCents: 5_000,
    conversationsIncludedBase: 1_000,
    /** @deprecated Cota de conversas passou para a org (`conversationsIncludedBase`). */
    conversationsPerInstance: 1_000,
    conversationsPerPack: 1_000,
    warnAtPercent: [80, 90] as const,
    /** Após este uso contínuo, rateio manual gera boleto por uso (ver termo de adesão). */
    billingAfterUsageDays: 3,
  },
  conversations: {
    countOnFirstContactActivity: true,
    uniquePerContactPerInstancePerMonth: true,
  },
  meta: {
    apiVersion: "v25.0",
    customerOwnsNumber: true,
    customerPaysMeta: true,
    webhookPath: "/cloud",
  },
  evolution: {
    engine: "go" as const,
    hostRegion: "br",
    redisPerContainer: true,
    provisionMaxRetries: 3,
    webhookPath: "/evo",
    /** Never-paired (`conectadoEm` null): timeout para liberar sessão remota no cleanup. */
    abandonedAfterMinutes: 30,
    /**
     * Já usou e caiu (`conectadoEm` setado): dias com sessão Evolution intacta
     * antes de `deleteInstance` + `sessaoRemotaLiberadaEm` (sem soft-delete do painel).
     */
    abandonedAfterUseDays: 5,
  },
  inbox: {
    autoCloseInactivityHours: 72,
    quickRepliesScope: "organization" as const,
    tagsPredefinedByAdmin: true,
    chatbotInMvp: false,
  },
  team: {
    inviteExpiresDays: 7,
    defaultInviteRole: "usuario" as const,
    memberRemoval: "deactivate" as const,
    ownershipTransferInMvp: false,
  },
  office: {
    accessMode: "email_allowlist" as const,
    impersonationInMvp: false,
    sessionMaxAgeDays: 3,
  },
  auth: {
    attemptRateLimit: 3,
    attemptRateLimitWindowSeconds: 60,
    otpRateLimit: 5,
    otpRateLimitWindowMinutes: 15,
    otpExpiresMinutes: 10,
    sessionMaxAgeDays: 15,
    sessionSliding: false,
  },
  legal: {
    lgpdConsentRequired: true,
    termsPlaceholder: true,
    /** Versão gravada em `organizacao.aceiteAdesaoVersao` na criação. */
    adesaoVersao: "2026-07",
  },
  cdn: {
    baseUrl: "https://cdn.whasap.com.br",
    bucket: "whasap-cdn",
    mediaPrefix: "media",
  },
} as const;
