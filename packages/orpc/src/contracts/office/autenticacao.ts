import { oc } from "@orpc/contract";
import { z } from "zod";

import { officeSessaoSchema, turnstileTokenSchema } from "../../schemas";

export const officeAutenticacaoContract = {
  enviarOtp: oc
    .input(
      turnstileTokenSchema.extend({
        email: z.string().email(),
      }),
    )
    .output(z.object({ ok: z.boolean() })),

  entrar: oc
    .input(
      turnstileTokenSchema.extend({
        email: z.string().email(),
        otp: z.string().length(6),
      }),
    )
    .output(officeSessaoSchema),

  sair: oc.input(z.object({})).output(z.object({ ok: z.boolean() })),

  eu: oc.output(officeSessaoSchema),
};
