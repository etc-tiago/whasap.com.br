import { Link, type ActiveOptions, type LinkProps } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "@whasap/ui/lib/utils";

const WA_RAIL_LINK_BASE =
  "relative flex h-11 w-11 items-center justify-center rounded-lg transition-colors";

export const waRailLinkActiveProps = {
  className: cn(WA_RAIL_LINK_BASE, "bg-wa-chip-active text-wa-green-dark"),
} as const;

export const waRailLinkInactiveProps = {
  className: cn(WA_RAIL_LINK_BASE, "text-wa-icon hover:bg-wa-hover"),
} as const;

/** Match exato da rota — não ativa em rotas filhas (ex.: inbox vs relatorios). */
export const waRailLinkActiveOptionsExact = { exact: true } as const satisfies ActiveOptions;

type WaRailLinkProps = LinkProps & {
  title: string;
  children: ReactNode;
};

export function WaRailLink({ title, children, activeOptions, ...linkProps }: WaRailLinkProps) {
  return (
    <Link
      {...linkProps}
      title={title}
      activeProps={waRailLinkActiveProps}
      inactiveProps={waRailLinkInactiveProps}
      activeOptions={activeOptions}
    >
      {children}
    </Link>
  );
}
