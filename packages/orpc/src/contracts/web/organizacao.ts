import { oc } from "@orpc/contract";
import { z } from "zod";

import {
  memberRoleSchema,
  organizacaoComPapelSchema,
  organizacaoHashSchema,
  organizacaoMembroSchema,
  organizacaoSchema,
} from "../../schemas";

export const organizacaoContract = {
  lista: oc.output(z.array(organizacaoSchema)),

  criar: oc.input(z.object({ nome: z.string().min(2) })).output(organizacaoSchema),

  obter: oc
    .input(z.object({ organizacaoHash: organizacaoHashSchema }))
    .output(organizacaoComPapelSchema),

  atualizar: oc
    .input(
      z.object({
        organizacaoHash: organizacaoHashSchema,
        nome: z.string().min(2).optional(),
        documento: z.string().optional(),
        tipoDocumento: z.enum(["cpf", "cnpj"]).optional(),
        razaoSocial: z.string().optional(),
      }),
    )
    .output(organizacaoSchema),

  trocar: oc
    .input(z.object({ organizacaoHash: organizacaoHashSchema }))
    .output(z.object({ ok: z.boolean() })),

  membros: {
    lista: oc
      .input(z.object({ organizacaoHash: organizacaoHashSchema }))
      .output(z.array(organizacaoMembroSchema)),

    convidar: oc
      .input(
        z.object({
          organizacaoHash: organizacaoHashSchema,
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
    lista: oc.input(z.object({ organizacaoHash: organizacaoHashSchema })).output(
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
        }),
      )
      .output(z.object({ ok: z.boolean(), organizacaoHash: z.string().uuid() })),
  },
};
