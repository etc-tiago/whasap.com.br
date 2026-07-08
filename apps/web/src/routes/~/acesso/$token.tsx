import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@whasap/ui/components/button";
import { useEffect, useRef, useState } from "react";

import { EntradaShell } from "@/components/entrada-shell";
import { sincronizarSessaoPosAuth } from "@/lib/auth";
import { getOrpcErrorMessage } from "@/lib/orpc-error";
import { orpc } from "@/lib/orpc";

export const Route = createFileRoute("/~/acesso/$token")({
  component: AcessoMagicoPage,
});

function AcessoMagicoPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const consumidoRef = useRef(false);

  const [error, setError] = useState<string | null>(null);

  const consumir = useMutation(orpc.autenticacao.consumirLinkMagico.mutationOptions());

  useEffect(() => {
    if (!token || consumidoRef.current) return;
    consumidoRef.current = true;

    consumir.mutate(
      { token },
      {
        onSuccess: async () => {
          await sincronizarSessaoPosAuth(queryClient);
          await navigate({ to: "/", replace: true });
        },
        onError: (err) => {
          setError(getOrpcErrorMessage(err, "Link inválido ou expirado."));
        },
      },
    );
  }, [token, consumir, queryClient, navigate]);

  if (error) {
    return (
      <EntradaShell title="Link expirado" description={error}>
        <Button asChild className="w-full">
          <Link to="/~">Voltar ao início</Link>
        </Button>
      </EntradaShell>
    );
  }

  return (
    <EntradaShell title="Entrando..." description="Validando seu link de acesso.">
      <p className="text-center text-sm text-muted-foreground">Aguarde...</p>
    </EntradaShell>
  );
}
