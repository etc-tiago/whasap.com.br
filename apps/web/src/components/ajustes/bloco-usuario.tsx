import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@whasap/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@whasap/ui/components/card";
import { Input } from "@whasap/ui/components/input";
import { Label } from "@whasap/ui/components/label";

import { orpc } from "@/lib/orpc";
import { getOrpcErrorMessage } from "@/lib/orpc-error";

/**
 * Bloco de customização da conta do usuário autenticado (nome).
 * Query e mutação próprias, independentes dos demais blocos de ajustes.
 */
export function BlocoUsuario() {
  const queryClient = useQueryClient();

  const [nome, setNome] = useState("");
  const [seedId, setSeedId] = useState<string | null>(null);

  const sessao = useQuery(orpc.autenticacao.eu.queryOptions({ retry: false }));

  useEffect(() => {
    if (!sessao.data?.usuario || seedId === sessao.data.usuario.id) return;
    setNome(sessao.data.usuario.nome);
    setSeedId(sessao.data.usuario.id);
  }, [sessao.data, seedId]);

  const atualizar = useMutation(
    orpc.autenticacao.atualizar.mutationOptions({
      onSuccess: async (usuario) => {
        setNome(usuario.nome);
        await queryClient.invalidateQueries({ queryKey: orpc.autenticacao.eu.key() });
      },
    }),
  );

  if (sessao.isPending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usuário</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Carregando…</p>
        </CardContent>
      </Card>
    );
  }

  if (!sessao.data?.usuario) return null;

  const alterado = nome.trim() !== sessao.data.usuario.nome.trim();
  const podeSalvar = nome.trim().length >= 2 && alterado && !atualizar.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Usuário</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="usuario-email">E-mail</Label>
          <Input id="usuario-email" value={sessao.data.usuario.email} disabled readOnly />
        </div>
        <div className="space-y-2">
          <Label htmlFor="usuario-nome">Nome</Label>
          <Input
            id="usuario-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            autoComplete="name"
          />
        </div>
        <Button disabled={!podeSalvar} onClick={() => atualizar.mutate({ nome: nome.trim() })}>
          {atualizar.isPending ? "Salvando…" : "Salvar"}
        </Button>
        {atualizar.isError && (
          <p className="text-sm text-destructive">
            {getOrpcErrorMessage(atualizar.error, "Não foi possível salvar a conta.")}
          </p>
        )}
        {atualizar.isSuccess && !alterado && (
          <p className="text-sm text-muted-foreground">Alterações salvas.</p>
        )}
      </CardContent>
    </Card>
  );
}
