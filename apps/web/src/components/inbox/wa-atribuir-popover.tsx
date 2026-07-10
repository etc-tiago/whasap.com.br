import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@whasap/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@whasap/ui/components/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@whasap/ui/components/select";
import { cn } from "@whasap/ui/lib/utils";
import { UserRound } from "lucide-react";
import { useEffect, useState } from "react";

import { orpc } from "@/lib/orpc";
import { getOrpcErrorMessage } from "@/lib/orpc-error";

type Membro = {
  id: string;
  usuarioId: string;
  usuarioNome?: string | null;
  role: string;
};

type WaAtribuirPopoverProps = {
  conversaId: string;
  instanciaId: string;
  usuarioAtribuidoId: string | null;
  usuarioAtribuidoNome: string | null;
  membros: Membro[];
  disabled?: boolean;
};

const NENHUM_ATENDENTE = "__nenhum__";

export function WaAtribuirPopover({
  conversaId,
  instanciaId,
  usuarioAtribuidoId,
  usuarioAtribuidoNome,
  membros,
  disabled,
}: WaAtribuirPopoverProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [usuarioId, setUsuarioId] = useState(usuarioAtribuidoId ?? NENHUM_ATENDENTE);

  useEffect(() => {
    if (open) {
      setUsuarioId(usuarioAtribuidoId ?? NENHUM_ATENDENTE);
    }
  }, [open, usuarioAtribuidoId]);

  const atribuir = useMutation(
    orpc.caixaEntrada.conversas.atribuir.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.caixaEntrada.conversas.lista.key({ input: { instanciaId } }),
        });
        setOpen(false);
      },
    }),
  );

  const rotulo =
    usuarioAtribuidoNome != null
      ? `Atribuído: ${usuarioAtribuidoNome}`
      : "Atribuir atendente";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex max-w-full items-center gap-1 truncate text-left text-xs text-wa-text-muted transition-colors",
            !disabled && "hover:text-wa-text",
          )}
        >
          <UserRound className="h-3 w-3 shrink-0" />
          <span className="truncate">{rotulo}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3 p-3">
        <p className="text-sm font-medium text-wa-text">Atribuir conversa</p>
        <Select value={usuarioId} onValueChange={setUsuarioId}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione um atendente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NENHUM_ATENDENTE}>Ninguém</SelectItem>
            {membros.map((m) => (
              <SelectItem key={m.id} value={m.usuarioId}>
                {m.usuarioNome ?? m.usuarioId.slice(0, 8)} ({m.role})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {atribuir.error ? (
          <p className="text-xs text-destructive">{getOrpcErrorMessage(atribuir.error, "Erro ao atribuir")}</p>
        ) : null}
        <Button
          size="sm"
          className="w-full"
          disabled={atribuir.isPending}
          onClick={() =>
            atribuir.mutate({
              conversaId,
              usuarioId: usuarioId === NENHUM_ATENDENTE ? null : usuarioId,
            })
          }
        >
          Salvar
        </Button>
      </PopoverContent>
    </Popover>
  );
}
