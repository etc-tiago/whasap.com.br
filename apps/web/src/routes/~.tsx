import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@whasap/ui/components/button";
import { Input } from "@whasap/ui/components/input";
import { Label } from "@whasap/ui/components/label";

import { EntradaShell } from "@/components/entrada-shell";
import { getOrpcErrorMessage } from "@/lib/orpc-error";
import { orpc } from "@/lib/orpc";

export const Route = createFileRoute("/~")({
  component: EntradaEmailPage,
});

function EntradaEmailPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const iniciar = useMutation(orpc.autenticacao.iniciarFluxo.mutationOptions());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const result = await iniciar.mutateAsync({ email });
      if (result.tipo === "entrar") {
        await navigate({ to: "/~/$hash", params: { hash: result.hash } });
      } else {
        await navigate({ to: "/~/email/$emailHash", params: { emailHash: result.hash } });
      }
    } catch (err) {
      setError(getOrpcErrorMessage(err, "Não foi possível continuar. Tente novamente."));
    }
  }

  return (
    <EntradaShell description="Informe seu e-mail para entrar ou criar sua conta.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="entrada-email">Email</Label>
          <Input
            id="entrada-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@empresa.com.br"
            autoComplete="email"
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={!email || iniciar.isPending}>
          Continuar
        </Button>
        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-center text-sm text-destructive">
            {error}
          </p>
        )}
      </form>
      <p className="text-center text-xs text-muted-foreground">
        Limite de 3 tentativas por minuto.
      </p>
    </EntradaShell>
  );
}
