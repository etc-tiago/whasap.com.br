import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { AuthPage } from "@/components/auth-page";
import { useSession } from "@/lib/auth";
import { orpc } from "@/lib/orpc";

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
    if (!session?.usuario || !orgs.isSuccess) return;

    if (orgs.data.length === 0) {
      navigate({ to: "/integracao", replace: true });
      return;
    }

    navigate({
      to: "/$organizacaoHash",
      params: { organizacaoHash: orgs.data[0]!.id },
      replace: true,
    });
  }, [session?.usuario, orgs.isSuccess, orgs.data, navigate]);

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Aguarde...
      </div>
    );
  }

  if (!session?.usuario) {
    return <AuthPage />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
      Aguarde...
    </div>
  );
}
