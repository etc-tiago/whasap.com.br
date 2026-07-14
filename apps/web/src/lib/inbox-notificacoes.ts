/**
 * Detecção pura de eventos de notificação a partir de deltas na lista de conversas.
 */
import { conversaRelevanteParaNotificacao } from "./inbox-permissoes";
import { formatarPreviewMensagem } from "./inbox-utils";

/** Campos mínimos da conversa para comparar entre polls. */
export type ConversaNotificacaoSnapshot = {
  id: string;
  contatoNome: string | null;
  contatoTelefone: string;
  usuarioAtribuidoId: string | null;
  ultimaMensagemEm: string | null;
  ultimaMensagemTipo?: string | null;
  ultimaMensagemPreview: string | null;
  naoLidas: number;
};

export type EventoInboxNotificacao = {
  tipo: "mensagem" | "atribuicao";
  conversaId: string;
  titulo: string;
  corpo: string;
};

function rotuloContato(c: ConversaNotificacaoSnapshot): string {
  const nome = c.contatoNome?.trim();
  return nome || c.contatoTelefone;
}

/**
 * Compara snapshots anterior e atual; retorna eventos relevantes para o usuário.
 * Na primeira carga (`prev` vazio / null) o caller não deve invocar — ou passar o mesmo mapa.
 */
export function detectarEventosInbox(
  prev: ReadonlyMap<string, ConversaNotificacaoSnapshot>,
  next: readonly ConversaNotificacaoSnapshot[],
  meuId: string,
): EventoInboxNotificacao[] {
  const eventos: EventoInboxNotificacao[] = [];

  for (const atual of next) {
    const anterior = prev.get(atual.id);

    if (!anterior) {
      // Conversa nova na lista: notificar mensagem se já tem não-lidas e é relevante;
      // atribuição se já veio atribuída a mim.
      if (
        atual.naoLidas > 0 &&
        conversaRelevanteParaNotificacao(atual.usuarioAtribuidoId, meuId)
      ) {
        eventos.push({
          tipo: "mensagem",
          conversaId: atual.id,
          titulo: rotuloContato(atual),
          corpo: formatarPreviewMensagem(
            atual.ultimaMensagemPreview,
            atual.ultimaMensagemTipo ?? undefined,
          ),
        });
      }
      if (atual.usuarioAtribuidoId === meuId) {
        eventos.push({
          tipo: "atribuicao",
          conversaId: atual.id,
          titulo: "Conversa atribuída a você",
          corpo: rotuloContato(atual),
        });
      }
      continue;
    }

    if (
      atual.naoLidas > anterior.naoLidas &&
      conversaRelevanteParaNotificacao(atual.usuarioAtribuidoId, meuId)
    ) {
      eventos.push({
        tipo: "mensagem",
        conversaId: atual.id,
        titulo: rotuloContato(atual),
        corpo: formatarPreviewMensagem(
          atual.ultimaMensagemPreview,
          atual.ultimaMensagemTipo ?? undefined,
        ),
      });
    }

    if (anterior.usuarioAtribuidoId !== meuId && atual.usuarioAtribuidoId === meuId) {
      eventos.push({
        tipo: "atribuicao",
        conversaId: atual.id,
        titulo: "Conversa atribuída a você",
        corpo: rotuloContato(atual),
      });
    }
  }

  return eventos;
}

/** Limita eventos exibidos e, se restarem, adiciona um resumo. */
export function limitarEventosNotificacao(
  eventos: EventoInboxNotificacao[],
  max = 3,
): EventoInboxNotificacao[] {
  if (eventos.length <= max) return eventos;
  const visiveis = eventos.slice(0, max);
  const resto = eventos.length - max;
  return [
    ...visiveis,
    {
      tipo: "mensagem",
      conversaId: visiveis[0]!.conversaId,
      titulo: `+${resto} conversas`,
      corpo: "Há mais atualizações na caixa de entrada",
    },
  ];
}

export function snapshotDeConversas(
  conversas: readonly ConversaNotificacaoSnapshot[],
): Map<string, ConversaNotificacaoSnapshot> {
  return new Map(conversas.map((c) => [c.id, c]));
}
