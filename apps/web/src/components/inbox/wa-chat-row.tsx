import type { ReactNode } from "react";
import { cn } from "@whasap/ui/lib/utils";

import { corAvatarContato, estiloAvatarContato } from "@/lib/inbox-utils";

type WaChatRowProps = {
  id: string;
  nome: string;
  preview?: ReactNode;
  time: string;
  ativo?: boolean;
  badge?: ReactNode;
  onClick: () => void;
};

export function WaChatRow({ id, nome, preview, time, ativo, badge, onClick }: WaChatRowProps) {
  const cor = corAvatarContato(id);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 border-b border-wa-divider px-4 py-3 text-left transition-colors",
        ativo ? "bg-wa-hover" : "hover:bg-wa-hover",
      )}
    >
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
        style={estiloAvatarContato(cor)}
      >
        {nome.slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-[15px] font-medium text-wa-text">{nome}</p>
          {time ? (
            <span className="shrink-0 text-xs text-wa-text-muted">{time}</span>
          ) : null}
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1 truncate text-sm text-wa-text-muted">
            {preview ?? "\u00A0"}
          </div>
          {badge ? <div className="flex shrink-0 items-center gap-1">{badge}</div> : null}
        </div>
      </div>
    </button>
  );
}
