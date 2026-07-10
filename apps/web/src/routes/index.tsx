import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { useSession } from "@/lib/auth";
import { orpc } from "@/lib/orpc";
import { buscarDestinoInboxOperacional } from "@/lib/resolver-destino-painel";

export const Route = createFileRoute("/")({
  component: RootPage,
});

function RootPage() {
  const navigate = useNavigate();
  const { data: session, isPending } = useSession();
  const orgs = useQuery({
    ...orpc.organizacao.lista.queryOptions(),
    enabled: Boolean(session?.usuario),
  });

  useEffect(() => {
    if (isPending) return;
    if (!session?.usuario) {
      void navigate({ to: "/~", replace: true });
      return;
    }
    if (!orgs.isSuccess) return;

    if (orgs.data.length === 0) {
      navigate({ to: "/integracao", replace: true });
      return;
    }

    let cancelled = false;

    void (async () => {
      const destino = await buscarDestinoInboxOperacional(orgs.data);
      if (cancelled) return;

      if (destino) {
        navigate({
          to: "/$organizacaoHash/inbox/$instanceId",
          params: {
            organizacaoHash: destino.organizacaoHash,
            instanceId: destino.instanceId,
          },
          replace: true,
        });
        return;
      }

      navigate({
        to: "/$organizacaoHash",
        params: { organizacaoHash: orgs.data[0]!.id },
        replace: true,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.usuario, isPending, orgs.isSuccess, orgs.data, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
      Aguarde...
    </div>
  );
}
