/**
 * Orquestra notificações do inbox: detecta deltas no poll de conversas e dispara
 * som + Notification API e/ou toast Sonner conforme foco/idle/rota.
 */
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { useSession } from "@/lib/auth";
import { useInboxConversas } from "@/lib/inbox-db";
import { tocarSomNotificacao, garantirUnlockSomNotificacao } from "@/lib/inbox-notificacao-som";
import {
  detectarEventosInbox,
  limitarEventosNotificacao,
  snapshotDeConversas,
  type ConversaNotificacaoSnapshot,
  type EventoInboxNotificacao,
} from "@/lib/inbox-notificacoes";
import { useMouseIdle } from "@/lib/use-mouse-idle";
import { useOrganizacaoHash } from "@/lib/use-organizacao-hash";

const IDLE_MS = 60_000;
const MAX_EVENTOS_UI = 3;

function eRotaInbox(pathname: string, organizacaoHash: string | undefined): boolean {
  if (!organizacaoHash) return false;
  return (
    pathname.includes(`/${organizacaoHash}/inbox`) || pathname.includes(`/${organizacaoHash}/chat/`)
  );
}

async function garantirPermissaoNotification(): Promise<NotificationPermission> {
  if (typeof Notification === "undefined") return "denied";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

function mostrarBrowserNotification(evento: EventoInboxNotificacao, onClick: () => void) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const n = new Notification(evento.titulo, {
    body: evento.corpo,
    tag: `inbox-${evento.tipo}-${evento.conversaId}`,
  });
  n.addEventListener("click", () => {
    window.focus();
    onClick();
    n.close();
  });
}

/**
 * Monitora a lista de conversas da org e notifica o usuário quando apropriado.
 * Montar no layout `/$organizacaoHash` para o poll continuar fora do Inbox.
 */
export function useInboxNotificacoes() {
  const organizacaoHash = useOrganizacaoHash();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: session } = useSession();
  const meuId = session?.usuario?.id;
  const { idle } = useMouseIdle(IDLE_MS);
  const conversations = useInboxConversas(organizacaoHash);

  const baselinePronto = useRef(false);
  const prevRef = useRef<Map<string, ConversaNotificacaoSnapshot>>(new Map());
  const idleRef = useRef(idle);
  idleRef.current = idle;
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useEffect(() => {
    garantirUnlockSomNotificacao();
  }, []);

  // Nova org/sessão: reestabelece baseline sem alertar.
  useEffect(() => {
    baselinePronto.current = false;
    prevRef.current = new Map();
  }, [organizacaoHash, meuId]);

  useEffect(() => {
    if (!meuId || !organizacaoHash || !conversations.isReady) return;
    if (conversations.isPending && conversations.data.length === 0) return;

    const next = conversations.data as ConversaNotificacaoSnapshot[];

    if (!baselinePronto.current) {
      prevRef.current = snapshotDeConversas(next);
      baselinePronto.current = true;
      return;
    }

    const eventos = limitarEventosNotificacao(
      detectarEventosInbox(prevRef.current, next, meuId),
      MAX_EVENTOS_UI,
    );
    prevRef.current = snapshotDeConversas(next);

    if (eventos.length === 0) return;

    const naInbox = eRotaInbox(pathnameRef.current, organizacaoHash);
    const abaVisivel = document.visibilityState === "visible";
    const mouseAtivo = !idleRef.current;

    // Silenciar: rota Inbox + aba em foco + mouse ativo (< 1 min)
    if (naInbox && abaVisivel && mouseAtivo) return;

    const usarToast = !naInbox && abaVisivel;
    const usarBrowser = !abaVisivel || (naInbox && !mouseAtivo);

    void (async () => {
      if (usarBrowser) {
        await garantirPermissaoNotification();
      }

      tocarSomNotificacao();

      for (const evento of eventos) {
        const irParaConversa = () => {
          void navigate({
            to: "/$organizacaoHash/chat/$conversaId",
            params: { organizacaoHash, conversaId: evento.conversaId },
          });
        };

        if (usarToast) {
          toast(evento.titulo, {
            description: evento.corpo,
            action: {
              label: "Abrir",
              onClick: irParaConversa,
            },
          });
        }

        if (usarBrowser) {
          mostrarBrowserNotification(evento, irParaConversa);
        }
      }
    })();
  }, [
    conversations.data,
    conversations.isPending,
    conversations.isReady,
    meuId,
    organizacaoHash,
    navigate,
  ]);
}
