import { oc } from "@orpc/contract";
import { z } from "zod";

import { officeSessaoSchema } from "../../schemas";

const loginOkSchema = z.object({});

export const officeAutenticacaoContract = {
  enviarOtp: oc
    .input(
      z.object({
        email: z.string().email(),
      }),
    )
    .output(z.object({ ok: z.boolean() })),

  entrar: oc
    .input(
      z.object({
        email: z.string().email(),
        otp: z.string().length(6),
      }),
    )
    .output(loginOkSchema),

  sair: oc.input(z.object({})).output(z.object({ ok: z.boolean() })),

  eu: oc.output(officeSessaoSchema),
};
