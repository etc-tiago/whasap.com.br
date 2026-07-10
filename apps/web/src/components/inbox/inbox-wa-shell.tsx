import { Link } from "@tanstack/react-router";
import { ArrowLeft, MoreVertical, Paperclip, Search, Send, Smile } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@whasap/ui/lib/utils";

type InboxWaShellProps = {
  organizacaoHash: string;
  instanceNome: string;
  conversas: ReactNode;
  chatHeader?: ReactNode;
  chatBody: ReactNode;
  composer?: ReactNode;
  selectedId: string | null;
};

export function InboxWaShell({
  organizacaoHash,
  instanceNome,
  conversas,
  chatHeader,
  chatBody,
  composer,
  selectedId,
}: InboxWaShellProps) {
  return (
    <div className="flex h-[calc(100vh-0px)] min-h-0 bg-wa-bg">
      <aside className="flex w-full max-w-md shrink-0 flex-col border-r border-wa-border bg-wa-panel md:w-[420px]">
        <header className="flex items-center gap-3 border-b border-wa-border bg-wa-panel-header px-4 py-3">
          <Link
            to="/$organizacaoHash/instancias"
            params={{ organizacaoHash }}
            className="rounded-full p-1.5 text-wa-icon hover:bg-black/5"
            title="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-wa-text">{instanceNome}</p>
            <p className="truncate text-xs text-wa-text-muted">Caixa de entrada</p>
          </div>
          <button
            type="button"
            className="rounded-full p-1.5 text-wa-icon hover:bg-black/5"
            aria-label="Buscar"
          >
            <Search className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="rounded-full p-1.5 text-wa-icon hover:bg-black/5"
            aria-label="Menu"
          >
            <MoreVertical className="h-5 w-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto wa-scroll">{conversas}</div>
      </aside>

      <section className="hidden min-w-0 flex-1 flex-col md:flex">
        {selectedId ? (
          <>
            <header className="flex items-center gap-3 border-b border-wa-border bg-wa-teal px-4 py-2.5 text-white shadow-sm">
              {chatHeader}
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto wa-wallpaper wa-scroll px-4 py-3">
              {chatBody}
            </div>
            {composer ? (
              <footer className="border-t border-wa-border bg-wa-panel-header px-3 py-2">
                {composer}
              </footer>
            ) : null}
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center wa-wallpaper px-6 text-center">
            <div className="mb-4 rounded-full bg-wa-panel p-6 shadow-sm">
              <Send className="h-10 w-10 text-wa-text-muted" />
            </div>
            <h2 className="text-lg font-medium text-wa-text">Whasap Web</h2>
            <p className="mt-2 max-w-sm text-sm text-wa-text-muted">
              Selecione uma conversa à esquerda para visualizar e responder mensagens.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

type ConversaItemProps = {
  nome: string;
  preview?: string | null;
  ativo?: boolean;
  badge?: ReactNode;
  onClick: () => void;
};

export function InboxWaConversaItem({
  nome,
  preview,
  ativo,
  badge,
  onClick,
}: ConversaItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 border-b border-wa-divider px-4 py-3 text-left transition hover:bg-wa-sidebar",
        ativo && "bg-wa-sidebar",
      )}
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-wa-green/15 text-sm font-semibold text-wa-green-dark">
        {nome.slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium text-wa-text">{nome}</p>
          {badge}
        </div>
        {preview ? (
          <p className="mt-0.5 truncate text-xs text-wa-text-muted">{preview}</p>
        ) : null}
      </div>
    </button>
  );
}

type BolhaProps = {
  outbound?: boolean;
  children: ReactNode;
};

export function InboxWaBolha({ outbound, children }: BolhaProps) {
  return (
    <div
      className={cn(
        "max-w-[min(75%,28rem)] rounded-lg px-3 py-2 text-sm shadow-sm",
        outbound
          ? "ml-auto bg-wa-bubble-out text-wa-text"
          : "mr-auto bg-wa-bubble-in text-wa-text",
      )}
    >
      {children}
    </div>
  );
}

type ComposerProps = {
  message: string;
  disabled?: boolean;
  pending?: boolean;
  onChange: (value: string) => void;
  onSend: () => void;
  extra?: ReactNode;
};

export function InboxWaComposer({
  message,
  disabled,
  pending,
  onChange,
  onSend,
  extra,
}: ComposerProps) {
  return (
    <div className="flex items-end gap-2">
      <button type="button" className="rounded-full p-2 text-wa-icon hover:bg-black/5" aria-label="Emoji">
        <Smile className="h-5 w-5" />
      </button>
      <button type="button" className="rounded-full p-2 text-wa-icon hover:bg-black/5" aria-label="Anexo">
        <Paperclip className="h-5 w-5" />
      </button>
      {extra}
      <div className="flex min-w-0 flex-1 items-center rounded-lg bg-wa-surface px-3 py-2 shadow-sm">
        <input
          value={message}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          disabled={disabled || pending}
          placeholder={disabled ? "Sem permissão para enviar" : "Digite uma mensagem"}
          className="w-full bg-transparent text-sm text-wa-text outline-none placeholder:text-wa-text-muted"
        />
      </div>
      <button
        type="button"
        onClick={onSend}
        disabled={disabled || pending || !message.trim()}
        className="rounded-full bg-wa-green p-2.5 text-white hover:bg-wa-green-dark disabled:opacity-40"
        aria-label="Enviar"
      >
        <Send className="h-5 w-5" />
      </button>
    </div>
  );
}
