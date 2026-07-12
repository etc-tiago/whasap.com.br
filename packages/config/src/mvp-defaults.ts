/**
 * MVP defaults for open product questions (plan 2026-07).
 * Override via env or future admin config where noted.
 */
export const mvpDefaults = {
  billing: {
    currency: "brl" as const,
    instancePriceCents: 9_900,
    conversationPackPriceCents: 9_900,
    conversationsPerInstance: 1_000,
    conversationsPerPack: 1_000,
    warnAtPercent: [80, 90] as const,
    gracePeriodDays: 7,
    cancelAtPeriodEnd: true,
    deactivatedRetentionDays: 90,
    trialDays: 3,
    multipleAddonsPerInstance: true,
    addonMidMonthImmediate: true,
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
    /** Instância não operacional há mais que isto entra no sweep do evolution-cleanup. */
    abandonedAfterMinutes: 30,
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
  },
  cdn: {
    baseUrl: "https://cdn.whasap.com.br",
    bucket: "whasap-cdn",
    mediaPrefix: "media",
  },
} as const;
