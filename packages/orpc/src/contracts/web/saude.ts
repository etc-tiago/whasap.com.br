import { oc } from "@orpc/contract";
import { z } from "zod";

export const saudeContract = {
  verificar: oc.output(z.object({ ok: z.boolean() })),
};
