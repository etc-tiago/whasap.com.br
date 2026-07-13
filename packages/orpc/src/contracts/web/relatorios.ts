import { oc } from "@orpc/contract";
import { z } from "zod";

import { organizacaoHashSchema } from "../../schemas";

const distribuicaoTempoRespostaSchema = z.object({
  ate5Min: z.number().int(),
  de5a15Min: z.number().int(),
  de15a60Min: z.number().int(),
  acima60Min: z.number().int(),
  semResposta: z.number().int(),
});

export const relatoriosContract = {
  visaoGeral: oc
    .input(
      z.object({
        organizacaoHash: organizacaoHashSchema,
        de: z.string().datetime(),
        ate: z.string().datetime(),
        /** Filtra pelo número/conexão (instância). */
        instanciaId: z.string().uuid().optional(),
        /** Filtra pelo atendente atribuído à conversa. */
        usuarioId: z.string().uuid().optional(),
      }),
    )
    .output(
      z.object({
        totalConversas: z.number().int(),
        conversasAbertas: z.number().int(),
        conversasFechadas: z.number().int(),
        /** Percentual 0–100 de conversas fechadas no período. */
        taxaFechamento: z.number(),
        conversasSemAtribuicao: z.number().int(),
        totalContatos: z.number().int(),
        mensagensEnviadas: z.number().int(),
        mensagensRecebidas: z.number().int(),
        mediaMensagensPorConversa: z.number().nullable(),
        /** Média em minutos da 1ª resposta (inbound → 1º outbound depois). */
        tempoMedioPrimeiraRespostaMinutos: z.number().nullable(),
        tempoMedianoPrimeiraRespostaMinutos: z.number().nullable(),
        /** Média em minutos entre criação e fechamento (só conversas fechadas com `fechadoEm`). */
        tempoMedioAteFechamentoMinutos: z.number().nullable(),
        conversasComResposta: z.number().int(),
        distribuicaoTempoResposta: distribuicaoTempoRespostaSchema,
        /** Volume diário no intervalo filtrado (dias sem movimento entram com zero). */
        serieDiaria: z.array(
          z.object({
            data: z.string(),
            conversas: z.number().int(),
            enviadas: z.number().int(),
            recebidas: z.number().int(),
          }),
        ),
        porTipoMensagem: z.array(
          z.object({
            tipo: z.string(),
            total: z.number().int(),
          }),
        ),
        /** Etiquetas aplicadas no período aos contatos das conversas filtradas. */
        itensInteresse: z.number().int(),
        porItemInteresse: z.array(
          z.object({
            id: z.string().uuid(),
            nome: z.string(),
            cor: z.string().nullable(),
            total: z.number().int(),
          }),
        ),
        porAgente: z.array(
          z.object({
            usuarioId: z.string().uuid(),
            nome: z.string(),
            conversasAtribuidas: z.number().int(),
            conversasFechadas: z.number().int(),
            mensagensEnviadas: z.number().int(),
            tempoMedioPrimeiraRespostaMinutos: z.number().nullable(),
          }),
        ),
        porInstancia: z.array(
          z.object({
            instanciaId: z.string().uuid(),
            nome: z.string(),
            conversas: z.number().int(),
            conversasAbertas: z.number().int(),
            conversasFechadas: z.number().int(),
            mensagensEnviadas: z.number().int(),
            mensagensRecebidas: z.number().int(),
          }),
        ),
      }),
    ),
};
