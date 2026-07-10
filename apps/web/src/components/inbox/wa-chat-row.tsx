import type { ReactNode } from "react";
import { cn } from "@whasap/ui/lib/utils";

import { corAvatarContato, estiloAvatarContato } from "@/lib/inbox-utils";

type EtiquetaChip = {
  id: string;
  nome: string;
  cor: string | null;
};

type WaChatRowProps = {
  id: string;
  nome: string;
  preview?: ReactNode;
  time: string;
  ativo?: boolean;
  naoLidas?: number;
  etiquetas?: EtiquetaChip[];
  badge?: ReactNode;
  onClick: () => void;
};

export function WaChatRow({
  id,
  nome,
  preview,
  time,
  ativo,
  naoLidas = 0,
  etiquetas = [],
  badge,
  onClick,
}: WaChatRowProps) {
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
            <span
              className={cn(
                "shrink-0 text-xs",
                naoLidas > 0 ? "font-medium text-wa-primary" : "text-wa-text-muted",
              )}
            >
              {time}
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm text-wa-text-muted">{preview ?? "\u00A0"}</div>
            {etiquetas.length > 0 ? (
              <div className="mt-1 flex flex-wrap gap-1">
                {etiquetas.slice(0, 2).map((etiqueta) => (
                  <span
                    key={etiqueta.id}
                    className="inline-flex max-w-[8rem] items-center gap-1 rounded-full bg-wa-chip px-2 py-0.5 text-[10px] text-wa-text-muted"
                  >
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: etiqueta.cor ?? "var(--wa-primary)" }}
                    />
                    <span className="truncate">{etiqueta.nome}</span>
                  </span>
                ))}
                {etiquetas.length > 2 ? (
                  <span className="text-[10px] text-wa-text-muted">+{etiquetas.length - 2}</span>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {badge}
            {naoLidas > 0 ? (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-wa-primary px-1.5 text-[11px] font-semibold text-white">
                {naoLidas > 99 ? "99+" : naoLidas}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </button>
  );
}
