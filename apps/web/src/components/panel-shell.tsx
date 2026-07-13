import { Outlet, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { DemonstracaoBanner } from "@/components/demonstracao-banner";
import { DemonstracaoLockout } from "@/components/demonstracao-lockout";
import { WaBackdrop } from "@/components/wa-backdrop";
import { instanciaOperacional } from "@/lib/instancia-status";
import { orgInput } from "@/lib/org-input";
import { orpc, orpcClient } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

type OrganizacaoComPapel = Awaited<ReturnType<typeof orpcClient.organizacao.obter>>;

export function PanelShell({
  children,
  organizacao,
}: {
  children?: ReactNode;
  organizacao: OrganizacaoComPapel;
}) {
  const organizacaoHash = organizacao.id;
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const comWallpaper = pathname.endsWith("/integracao");

  const instancias = useQuery(
    orpc.instancia.lista.queryOptions({ input: orgInput(organizacaoHash) }),
  );

  const instanciaPagamento =
    instancias.data?.find((i) => i.status === "connected" && !i.asaasSubscriptionId) ??
    instancias.data?.find((i) => instanciaOperacional(i.status)) ??
    null;

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-wa-bg">
      {comWallpaper && <WaBackdrop />}
      <main className="relative min-h-0 flex-1 overflow-hidden">
        {children ?? <Outlet />}
        <DemonstracaoLockout
          demonstracao={organizacao.demonstracao}
          isAdmin={organizacao.meuPapel === "admin"}
        />
      </main>
      <DemonstracaoBanner
        demonstracao={organizacao.demonstracao}
        isAdmin={organizacao.meuPapel === "admin"}
        instanciaId={instanciaPagamento?.id ?? null}
        instanciaNome={instanciaPagamento?.nome ?? null}
      />
    </div>
  );
}
