import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@whasap/ui/components/badge";
import { Button } from "@whasap/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@whasap/ui/components/card";
import { Input } from "@whasap/ui/components/input";
import { Label } from "@whasap/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@whasap/ui/components/select";

import { useSession } from "@/lib/auth";
import { orgInput } from "@/lib/org-input";
import { orpc } from "@/lib/orpc";
import { useOrganizacaoHash } from "@/lib/use-organizacao-hash";

export const Route = createFileRoute("/_panel/$organizacaoHash/equipe")({
  component: EquipePage,
});

function EquipePage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const organizacaoHash = useOrganizacaoHash();

  const org = useQuery(
    orpc.organizacao.obter.queryOptions({
      input: orgInput(organizacaoHash),
    }),
  );

  const isAdmin = org.data?.meuPapel === "admin";

  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [role, setRole] = useState<"admin" | "usuario" | "analista">("usuario");

  const membros = useQuery(
    orpc.organizacao.membros.lista.queryOptions({
      input: orgInput(organizacaoHash),
    }),
  );

  const convites = useQuery(
    orpc.organizacao.convites.lista.queryOptions({
      input: orgInput(organizacaoHash),
      enabled: isAdmin,
    }),
  );

  const convidar = useMutation(
    orpc.organizacao.membros.convidar.mutationOptions({
      onSuccess: () => {
        setEmail("");
        setNome("");
        if (organizacaoHash) {
          queryClient.invalidateQueries({
            queryKey: orpc.organizacao.convites.lista.key({
              input: { organizacaoHash },
            }),
          });
        }
      },
    }),
  );

  const atualizarPapel = useMutation(
    orpc.organizacao.membros.atualizarPapel.mutationOptions({
      onSuccess: () => {
        if (organizacaoHash) {
          queryClient.invalidateQueries({
            queryKey: orpc.organizacao.membros.lista.key({
              input: { organizacaoHash },
            }),
          });
        }
      },
    }),
  );

  if (!isAdmin) {
    return <p className="p-6 text-sm text-muted-foreground">Acesso restrito a administradores.</p>;
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Equipe</h1>

      <Card>
        <CardHeader>
          <CardTitle>Membros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(membros.data ?? []).map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">{m.usuarioNome ?? m.usuarioEmail ?? m.usuarioId}</p>
                <Badge variant="secondary">{m.role}</Badge>
              </div>
              {m.usuarioId !== session?.usuario?.id && (
                <Select
                  value={m.role}
                  onValueChange={(v) =>
                    atualizarPapel.mutate({
                      membroId: m.id,
                      role: v as "admin" | "usuario" | "analista",
                    })
                  }
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="usuario">Usuário</SelectItem>
                    <SelectItem value="analista">Analista</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Convidar membro</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
          </div>
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Papel</Label>
            <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="usuario">Usuário</SelectItem>
                <SelectItem value="analista">Analista</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            disabled={!organizacaoHash || !email || convidar.isPending}
            onClick={() =>
              organizacaoHash &&
              convidar.mutate({ organizacaoHash, email, nome: nome || undefined, role })
            }
          >
            Enviar convite
          </Button>
        </CardContent>
      </Card>

      {(convites.data?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Convites pendentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {convites.data?.map((c) => (
              <div key={c.id} className="flex justify-between rounded-lg border p-3 text-sm">
                <span>{c.email}</span>
                <Badge variant="outline">{c.role}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
