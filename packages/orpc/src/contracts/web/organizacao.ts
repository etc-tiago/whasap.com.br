import { oc } from "@orpc/contract";
import { z } from "zod";

import {
  memberRoleSchema,
  organizacaoMembroSchema,
  organizacaoSchema,
} from "../../schemas";

export const organizacaoContract = {
  lista: oc.output(z.array(organizacaoSchema)),

  obter: oc
    .input(z.object({ organizacaoId: z.string().uuid() }))
    .output(organizacaoSchema),

  atualizar: oc
    .input(
      z.object({
        organizacaoId: z.string().uuid(),
        nome: z.string().min(2).optional(),
        documento: z.string().optional(),
        tipoDocumento: z.enum(["cpf", "cnpj"]).optional(),
        razaoSocial: z.string().optional(),
      }),
    )
    .output(organizacaoSchema),

  trocar: oc
    .input(z.object({ organizacaoId: z.string().uuid() }))
    .output(z.object({ ok: z.boolean() })),

  membros: {
    lista: oc
      .input(z.object({ organizacaoId: z.string().uuid() }))
      .output(z.array(organizacaoMembroSchema)),

    convidar: oc
      .input(
        z.object({
          organizacaoId: z.string().uuid(),
          email: z.string().email(),
          nome: z.string().min(2).optional(),
          role: memberRoleSchema.default("usuario"),
        }),
      )
      .output(z.object({ conviteId: z.string().uuid(), urlConvite: z.string() })),

    atualizarPapel: oc
      .input(
        z.object({
          membroId: z.string().uuid(),
          role: memberRoleSchema,
        }),
      )
      .output(z.object({ ok: z.boolean() })),

    desativar: oc
      .input(z.object({ membroId: z.string().uuid() }))
      .output(z.object({ ok: z.boolean() })),
  },

  convites: {
    lista: oc
      .input(z.object({ organizacaoId: z.string().uuid() }))
      .output(
        z.array(
          z.object({
            id: z.string().uuid(),
            email: z.string(),
            nome: z.string().nullable(),
            role: memberRoleSchema,
            expiraEm: z.string().datetime(),
            aceitoEm: z.string().datetime().nullable(),
          }),
        ),
      ),

    aceitar: oc
      .input(
        z.object({
          token: z.string().min(1),
          otp: z.string().length(6),
          turnstileToken: z.string().min(1),
        }),
      )
      .output(z.object({ ok: z.boolean(), organizacaoId: z.string().uuid() })),
  },
};
