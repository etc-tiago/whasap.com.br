/**
 * MVP defaults for open product questions (plan 2026-07).
 * Override via env or future admin config where noted.
 */
export const mvpDefaults = {
  billing: {
    currency: "brl" as const,
    /** Após este uso contínuo (teste), rateio manual gera boleto por uso (ver termo de adesão). */
    billingAfterUsageDays: 7,
    /** Conexão WhatsApp além das inclusas no plano. */
    extraConnectionPriceCents: 3_900,
    /** Contatos únicos adicionais são vendidos em blocos deste tamanho. */
    contactsPerExtraPack: 100,
    referral: {
      /** Meses grátis (crédito) para quem indicou. */
      indicadorMesGratis: 1,
      /** Desconto percentual no 1º mês do indicado. */
      indicadoDescontoPercent: 25,
    },
    plans: [
      {
        id: "starter",
        nome: "Starter",
        priceCents: 12_900,
        contactsIncluded: 600,
        connectionsIncluded: 1,
        extraContactsPackPriceCents: 1_500,
      },
      {
        id: "profissional",
        nome: "Profissional",
        priceCents: 24_900,
        contactsIncluded: 1_500,
        connectionsIncluded: 1,
        extraContactsPackPriceCents: 1_500,
      },
      {
        id: "business",
        nome: "Business",
        priceCents: 39_900,
        contactsIncluded: 4_000,
        connectionsIncluded: 2,
        extraContactsPackPriceCents: 1_500,
      },
      {
        id: "enterprise",
        nome: "Enterprise",
        priceCents: 59_900,
        contactsIncluded: 10_000,
        connectionsIncluded: 3,
        extraContactsPackPriceCents: 1_200,
      },
    ] as const,
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
    /** Campos a assinar no console Meta (Webhook → Webhook fields). */
    webhookSubscribeFields: ["messages", "message_template_status_update"] as const,
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
    adesaoVersao: "2026-07-precos",
  },
  cdn: {
    baseUrl: "https://cdn.whasap.com.br",
    bucket: "whasap-cdn",
    mediaPrefix: "media",
  },
} as const;
