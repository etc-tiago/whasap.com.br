import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@whasap/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@whasap/ui/components/card";
import { Input } from "@whasap/ui/components/input";
import { Label } from "@whasap/ui/components/label";

import { WaBackdrop } from "@/components/wa-backdrop";
import { orpc } from "@/lib/orpc";

export const Route = createFileRoute("/_panel/integracao")({
  component: IntegracaoPage,
});

function IntegracaoPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [nome, setNome] = useState("");
  const criar = useMutation(orpc.organizacao.criar.mutationOptions());

  async function handleCriar() {
    if (!nome.trim()) return;
    const org = await criar.mutateAsync({ nome: nome.trim() });
    await queryClient.invalidateQueries({ queryKey: orpc.organizacao.lista.key() });
    navigate({
      to: "/$organizacaoHash",
      params: { organizacaoHash: org.id },
    });
  }

  return (
    <>
      <WaBackdrop />
      <div className="relative flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Nova organização</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-nome">Nome da organização</Label>
              <Input
                id="org-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Minha empresa"
              />
            </div>
            <Button
              className="w-full"
              disabled={!nome.trim() || criar.isPending}
              onClick={handleCriar}
            >
              Criar organização
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
