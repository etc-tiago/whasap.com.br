import { oc } from "@orpc/contract";
import { z } from "zod";

import {
  memberRoleSchema,
  organizacaoComPapelSchema,
  organizacaoHashSchema,
  organizacaoMembroSchema,
  organizacaoSchema,
} from "../../schemas";

const documentoCnpjSchema = z
  .string()
  .min(14)
  .refine((v) => v.replace(/\D/g, "").length === 14, { message: "CNPJ inválido" });

const telefoneWhatsappSchema = z
  .string()
  .min(10)
  .refine(
    (v) => {
      const d = v.replace(/\D/g, "");
      if (d.startsWith("55") && (d.length === 12 || d.length === 13)) return true;
      return d.length === 10 || d.length === 11;
    },
    { message: "WhatsApp inválido" },
  );

export const organizacaoContract = {
  lista: oc.output(z.array(organizacaoSchema)),

  criar: oc
    .input(
      z.object({
        nome: z.string().min(2),
        documento: documentoCnpjSchema,
        tipoDocumento: z.literal("cnpj"),
        razaoSocial: z.string().min(2),
        telefoneWhatsapp: telefoneWhatsappSchema,
        aceiteAdesao: z.literal(true),
      }),
    )
    .output(organizacaoSchema),

  obter: oc
    .input(z.object({ organizacaoHash: organizacaoHashSchema }))
    .output(organizacaoComPapelSchema),

  atualizar: oc
    .input(
      z.object({
        organizacaoHash: organizacaoHashSchema,
        nome: z.string().min(2).optional(),
        documento: documentoCnpjSchema.optional(),
        tipoDocumento: z.literal("cnpj").optional(),
        razaoSocial: z.string().min(2).optional(),
        telefoneWhatsapp: telefoneWhatsappSchema.optional(),
        horasAutoFecharInatividade: z
          .string()
          .regex(/^\d+$/, "Informe um número inteiro de horas")
          .optional(),
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
