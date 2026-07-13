import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@whasap/ui/components/button";
import { Input } from "@whasap/ui/components/input";
import { Label } from "@whasap/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@whasap/ui/components/select";

import { orpc } from "@/lib/orpc";
import { getOrpcErrorMessage } from "@/lib/orpc-error";
import { useOrganizacaoHash } from "@/lib/use-organizacao-hash";

type Papel = "admin" | "usuario" | "analista";

/**
 * Formulário de convite de membro — ativado via `?convidar=1` na rota de usuários.
 */
export function ConvidarMembro() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const organizacaoHash = useOrganizacaoHash();

  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [role, setRole] = useState<Papel>("usuario");

  const invalidarConvites = () => {
    if (!organizacaoHash) return;
    void queryClient.invalidateQueries({
      queryKey: orpc.organizacao.convites.lista.key({
        input: { organizacaoHash },
      }),
    });
  };

  const fechar = () => {
    if (!organizacaoHash) return;
    void navigate({
      to: "/$organizacaoHash/ajustes/usuarios",
      params: { organizacaoHash },
      search: { convidar: "" },
    });
  };

  const convidar = useMutation(
    orpc.organizacao.membros.convidar.mutationOptions({
      onSuccess: () => {
        setEmail("");
        setNome("");
        setRole("usuario");
        invalidarConvites();
        fechar();
      },
    }),
  );

  if (!organizacaoHash) return null;

  return (
    <section className="max-w-md space-y-3 rounded-lg border border-wa-divider p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-wa-text">Convidar membro</h3>
        <Button variant="ghost" size="sm" onClick={fechar}>
          Fechar
        </Button>
      </div>
      <div className="space-y-2">
        <Label htmlFor="convite-email">Email</Label>
        <Input
          id="convite-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="off"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="convite-nome">Nome</Label>
        <Input
          id="convite-nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          autoComplete="off"
        />
      </div>
      <div className="space-y-2">
        <Label>Papel</Label>
        <Select value={role} onValueChange={(v) => setRole(v as Papel)}>
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
        disabled={!email || convidar.isPending}
        onClick={() =>
          convidar.mutate({
            organizacaoHash,
            email,
            nome: nome || undefined,
            role,
          })
        }
      >
        Enviar convite
      </Button>
      {convidar.isError ? (
        <p className="text-sm text-destructive">
          {getOrpcErrorMessage(convidar.error, "Não foi possível enviar o convite.")}
        </p>
      ) : null}
    </section>
  );
}
