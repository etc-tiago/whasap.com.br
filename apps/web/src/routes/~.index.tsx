import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@whasap/ui/components/button";
import { Input } from "@whasap/ui/components/input";
import { Label } from "@whasap/ui/components/label";
import { useState } from "react";

import { EntradaShell } from "@/components/entrada-shell";
import { orpc } from "@/lib/orpc";
import { getOrpcErrorMessage } from "@/lib/orpc-error";

export const Route = createFileRoute("/~/")({
  component: EntradaEmailPage,
});

function EntradaEmailPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const iniciar = useMutation(orpc.autenticacao.iniciarFluxo.mutationOptions());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const result = await iniciar.mutateAsync({ email });
      window.location.assign(result.redirectPath);
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
    </EntradaShell>
  );
}
