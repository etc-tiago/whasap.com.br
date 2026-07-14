import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { Loader2, Plug, Settings, Tag, Users } from "lucide-react";
import { lazy, Suspense, type ComponentType } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@whasap/ui/components/dialog";
import { cn } from "@whasap/ui/lib/utils";

import type { AjustesSecao, OrganizacaoSearch } from "@/lib/ajustes-search";

const routeApi = getRouteApi("/$organizacaoHash");

const SecaoGeral = lazy(() =>
  import("@/components/ajustes/secoes/secao-geral").then((m) => ({ default: m.SecaoAjustesGeral })),
);
const SecaoUsuarios = lazy(() =>
  import("@/components/ajustes/secoes/secao-usuarios").then((m) => ({
    default: m.SecaoAjustesUsuarios,
  })),
);
const SecaoConexao = lazy(() =>
  import("@/components/ajustes/secoes/secao-conexao").then((m) => ({
    default: m.SecaoAjustesConexao,
  })),
);
const SecaoEtiquetas = lazy(() =>
  import("@/components/ajustes/secoes/secao-etiquetas").then((m) => ({
    default: m.SecaoAjustesEtiquetas,
  })),
);

const NAV: Array<{
  secao: AjustesSecao;
  rotulo: string;
  icone: ComponentType<{ className?: string }>;
}> = [
  { secao: "geral", rotulo: "Geral", icone: Settings },
  { secao: "usuarios", rotulo: "Usuários", icone: Users },
  { secao: "etiquetas", rotulo: "Etiquetas", icone: Tag },
  { secao: "conexao", rotulo: "Conexões", icone: Plug },
];

function FallbackSecao() {
  return (
    <div className="flex flex-1 items-center justify-center p-12">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Carregando" />
    </div>
  );
}

/**
 * Modal global de Ajustes — aberto via `?ajustes=` em qualquer rota da org.
 */
export function WaAjustesModal() {
  const navigate = useNavigate();
  const { ajustes, convidar } = routeApi.useSearch();
  const aberto = Boolean(ajustes);
  const secaoAtiva: AjustesSecao = ajustes ?? "geral";

  function fechar() {
    void navigate({
      to: ".",
      search: (prev: OrganizacaoSearch) => {
        const { ajustes: _a, convidar: _c, ...rest } = prev;
        return rest;
      },
      replace: true,
    });
  }

  function irPara(secao: AjustesSecao) {
    void navigate({
      to: ".",
      search: (prev: OrganizacaoSearch) => ({
        ...prev,
        ajustes: secao,
        ...(secao === "usuarios" ? {} : { convidar: undefined }),
      }),
      replace: true,
    });
  }

  return (
    <Dialog
      open={aberto}
      onOpenChange={(open) => {
        if (!open) fechar();
      }}
    >
      <DialogContent
        className={cn(
          "flex h-[min(40rem,90vh)] max-h-[90vh] w-full max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:rounded-lg",
          "left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%]",
          "max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:w-full max-sm:max-w-none max-sm:rounded-none",
        )}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Ajustes</DialogTitle>
          <DialogDescription>Configurações da organização e da conta.</DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1">
          <nav className="flex w-52 shrink-0 flex-col border-r border-border bg-muted/30 p-2 max-sm:w-40">
            <p className="px-3 py-2 text-sm font-semibold text-foreground">Ajustes</p>
            {NAV.map(({ secao, rotulo, icone: Icone }) => (
              <button
                key={secao}
                type="button"
                onClick={() => irPara(secao)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
                  secaoAtiva === secao
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                <Icone className="h-4 w-4 shrink-0" />
                {rotulo}
              </button>
            ))}
          </nav>
          <div className="min-h-0 min-w-0 flex-1 overflow-auto">
            <Suspense fallback={<FallbackSecao />}>
              {secaoAtiva === "geral" ? <SecaoGeral /> : null}
              {secaoAtiva === "usuarios" ? (
                <SecaoUsuarios convidarAberto={convidar === "1"} />
              ) : null}
              {secaoAtiva === "conexao" ? <SecaoConexao /> : null}
              {secaoAtiva === "etiquetas" ? <SecaoEtiquetas /> : null}
            </Suspense>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
