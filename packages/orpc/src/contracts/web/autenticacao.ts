import { oc } from "@orpc/contract";
import { z } from "zod";

import { sessaoSchema } from "../../schemas";

const fluxoPublicoSchema = z.object({
  hash: z.string().uuid(),
  tipo: z.enum(["entrar", "cadastrar"]),
  emailMascarado: z.string(),
  nomeSugerido: z.string().nullable(),
  bloqueado: z.boolean(),
  pedidosOtpRestantes: z.number().int(),
  tentativasInvalidasRestantes: z.number().int(),
  redirectPathBloqueado: z.string().nullable(),
  otpEnviado: z.boolean().optional(),
});

export const autenticacaoContract = {
  enviarOtp: oc
    .input(
      z.object({
        email: z.string().email(),
        proposito: z.enum(["entrar", "cadastrar", "convite"]),
      }),
    )
    .output(z.object({ ok: z.boolean() })),

  cadastrar: oc
    .input(
      z.object({
        email: z.string().email(),
        nome: z.string().min(2),
        otp: z.string().length(6),
        lgpdConsent: z.literal(true),
      }),
    )
    .output(sessaoSchema),

  entrar: oc
    .input(
      z.object({
        email: z.string().email(),
        otp: z.string().length(6),
      }),
    )
    .output(sessaoSchema),

  sair: oc.input(z.object({})).output(z.object({ ok: z.boolean() })),

  eu: oc.output(sessaoSchema),

  iniciarFluxo: oc
    .input(z.object({ email: z.string().email() }))
    .output(
      z.object({
        hash: z.string().uuid(),
        tipo: z.enum(["entrar", "cadastrar"]),
        redirectPath: z.string(),
      }),
    ),

  obterFluxo: oc
    .input(z.object({ hash: z.string().uuid() }))
    .output(fluxoPublicoSchema),

  enviarOtpFluxo: oc
    .input(z.object({ hash: z.string().uuid() }))
    .output(z.object({ ok: z.boolean(), bloqueado: z.boolean() })),

  entrarFluxo: oc
    .input(z.object({ hash: z.string().uuid(), otp: z.string().length(6) }))
    .output(sessaoSchema),

  cadastrarFluxo: oc
    .input(
      z.object({
        hash: z.string().uuid(),
        otp: z.string().length(6),
        lgpdConsent: z.literal(true),
      }),
    )
    .output(sessaoSchema),
};
