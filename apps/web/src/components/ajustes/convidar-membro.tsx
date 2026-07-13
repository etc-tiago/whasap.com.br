import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@whasap/ui/components/button";
import { Input } from "@whasap/ui/components/input";
import { Label } from "@whasap/ui/components/label";
import { Popover, PopoverContent, PopoverTrigger } from "@whasap/ui/components/popover";
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

type ConvidarMembroProps = {
  /** Aberto quando search param `convidar=1`. */
  open: boolean;
};

/**
 * Botão + formulário de convite em popover — aberto via `?convidar=1`.
 */
export function ConvidarMembro({ open }: ConvidarMembroProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const organizacaoHash = useOrganizacaoHash();

  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [role, setRole] = useState<Papel>("usuario");

  const setAberto = (proximo: boolean) => {
    if (!organizacaoHash) return;
    void navigate({
      to: "/$organizacaoHash/ajustes/usuarios",
      params: { organizacaoHash },
      search: { convidar: proximo ? "1" : "" },
    });
  };

  const invalidarConvites = () => {
    if (!organizacaoHash) return;
    void queryClient.invalidateQueries({
      queryKey: orpc.organizacao.convites.lista.key({
        input: { organizacaoHash },
      }),
    });
  };

  const convidar = useMutation(
    orpc.organizacao.membros.convidar.mutationOptions({
      onSuccess: () => {
        setEmail("");
        setNome("");
        setRole("usuario");
        invalidarConvites();
        setAberto(false);
      },
    }),
  );

  if (!organizacaoHash) return null;

  return (
    <Popover open={open} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button size="sm">Convidar membro</Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3 p-4">
        <p className="text-sm font-medium text-wa-text">Convidar membro</p>
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
          className="w-full"
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
      </PopoverContent>
    </Popover>
  );
}
