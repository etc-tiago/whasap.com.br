import { oc } from "@orpc/contract";
import { z } from "zod";

import { sessaoSchema } from "../../schemas";

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
};
