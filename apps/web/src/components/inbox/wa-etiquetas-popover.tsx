import { skipToken, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@whasap/ui/components/button";
import { Input } from "@whasap/ui/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@whasap/ui/components/popover";
import { cn } from "@whasap/ui/lib/utils";
import { Check, Plus, Tag } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import { WaIconButton } from "@/components/inbox/wa-icon-button";
import { orgInput } from "@/lib/org-input";
import { orpc } from "@/lib/orpc";
import { getOrpcErrorMessage } from "@/lib/orpc-error";

type Etiqueta = {
  id: string;
  nome: string;
  cor: string | null;
};

type EtiquetasContextValue = {
  disabled?: boolean;
  resumo: string | null;
  ativas: Etiqueta[];
  open: boolean;
  setOpen: (open: boolean) => void;
  alternar: (etiquetaId: string, ativa: boolean) => void;
  pendente: boolean;
};

const EtiquetasContext = createContext<EtiquetasContextValue | null>(null);

function useEtiquetasContext() {
  const ctx = useContext(EtiquetasContext);
  if (!ctx) {
    throw new Error("Componentes de etiquetas devem estar dentro de WaEtiquetasPopover");
  }
  return ctx;
}

type WaEtiquetasPopoverProps = {
  organizacaoHash: string;
  contatoId: string;
  instanciaId?: string;
  disabled?: boolean;
  children: ReactNode;
};

function formatarResumoEtiquetas(etiquetas: Etiqueta[]) {
  if (etiquetas.length === 0) return null;
  if (etiquetas.length === 1) return etiquetas[0]!.nome;
  const restantes = etiquetas.length - 1;
  const sufixo = restantes === 1 ? "item" : "itens";
  return `${etiquetas[0]!.nome} + ${restantes} ${sufixo}...`;
}

function WaEtiquetasPopoverRoot({
  organizacaoHash,
  contatoId,
  instanciaId,
  disabled,
  children,
}: WaEtiquetasPopoverProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [novoNome, setNovoNome] = useState("");

  const etiquetasOrg = useQuery(
    orpc.caixaEntrada.etiquetas.lista.queryOptions({
      input: orgInput(organizacaoHash),
      enabled: open,
    }),
  );

  const etiquetasContato = useQuery(
    orpc.caixaEntrada.etiquetas.porContato.queryOptions({
      input: contatoId ? { contatoId } : skipToken,
    }),
  );

  const atribuir = useMutation(
    orpc.caixaEntrada.etiquetas.atribuir.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.caixaEntrada.etiquetas.porContato.key({ input: { contatoId } }),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.caixaEntrada.conversas.lista.key(),
        });
      },
    }),
  );

  const remover = useMutation(
    orpc.caixaEntrada.etiquetas.remover.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.caixaEntrada.etiquetas.porContato.key({ input: { contatoId } }),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.caixaEntrada.conversas.lista.key(),
        });
      },
    }),
  );

  const criar = useMutation(
    orpc.caixaEntrada.etiquetas.criar.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.caixaEntrada.etiquetas.lista.key({ input: { organizacaoHash } }),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.caixaEntrada.etiquetas.porContato.key({ input: { contatoId } }),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.caixaEntrada.conversas.lista.key(),
        });
        setNovoNome("");
      },
    }),
  );

  const ativas = useMemo(() => etiquetasContato.data ?? [], [etiquetasContato.data]);
  const idsAtivos = new Set(ativas.map((e) => e.id));
  const resumo = formatarResumoEtiquetas(ativas);
  const pendente = atribuir.isPending || remover.isPending || criar.isPending;
  const erro = atribuir.error ?? remover.error ?? criar.error;

  const criarEtiqueta = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const nome = novoNome.trim();
      if (!nome || pendente || disabled) return;
      criar.mutate({
        organizacaoHash,
        nome,
        contatoId,
        instanciaId,
      });
    },
    [contatoId, criar, disabled, instanciaId, novoNome, organizacaoHash, pendente],
  );

  const alternar = useCallback(
    (etiquetaId: string, ativa: boolean) => {
      if (pendente || disabled) return;
      if (ativa) {
        remover.mutate({ contatoId, etiquetaId });
      } else {
        atribuir.mutate({ contatoId, etiquetaId });
      }
    },
    [atribuir, contatoId, disabled, pendente, remover],
  );

  const contextValue = useMemo(
    () => ({
      disabled,
      resumo,
      ativas,
      open,
      setOpen,
      alternar,
      pendente,
    }),
    [alternar, ativas, disabled, open, pendente, resumo],
  );

  return (
    <EtiquetasContext.Provider value={contextValue}>
      <Popover open={open} onOpenChange={setOpen}>
        {children}
        <PopoverContent align="end" className="w-72 p-0">
          <div className="border-b border-wa-divider px-3 py-2.5">
            <p className="text-sm font-medium text-wa-text">Etiquetas</p>
            {resumo ? (
              <p className="mt-0.5 truncate text-xs text-wa-text-muted">{resumo}</p>
            ) : (
              <p className="mt-0.5 text-xs text-wa-text-muted">Nenhuma etiqueta no contato</p>
            )}
            <form onSubmit={criarEtiqueta} className="mt-2 flex gap-1.5">
              <Input
                value={novoNome}
                disabled={disabled || pendente}
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder="Nova etiqueta"
                className="h-8 flex-1 text-sm"
                maxLength={100}
              />
              <Button
                type="submit"
                size="sm"
                variant="secondary"
                disabled={disabled || pendente || !novoNome.trim()}
                className="h-8 shrink-0 px-2"
                aria-label="Criar etiqueta"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </form>
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {etiquetasOrg.isLoading ? (
              <p className="px-2 py-3 text-xs text-wa-text-muted">Carregando...</p>
            ) : (etiquetasOrg.data ?? []).length === 0 ? (
              <p className="px-2 py-3 text-xs text-wa-text-muted">
                Nenhuma etiqueta cadastrada na organização.
              </p>
            ) : (
              (etiquetasOrg.data ?? []).map((etiqueta) => {
                const ativa = idsAtivos.has(etiqueta.id);
                return (
                  <button
                    key={etiqueta.id}
                    type="button"
                    disabled={disabled || pendente}
                    onClick={() => alternar(etiqueta.id, ativa)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors",
                      "hover:bg-wa-hover",
                      ativa && "bg-wa-chip-active",
                    )}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: etiqueta.cor ?? "var(--wa-primary)" }}
                    />
                    <span className="min-w-0 flex-1 truncate text-wa-text">{etiqueta.nome}</span>
                    {ativa ? <Check className="h-4 w-4 shrink-0 text-wa-primary" /> : null}
                  </button>
                );
              })
            )}
          </div>
          {erro ? (
            <p className="border-t border-wa-divider px-3 py-2 text-xs text-destructive">
              {getOrpcErrorMessage(erro, "Erro ao atualizar etiquetas")}
            </p>
          ) : null}
          <div className="border-t border-wa-divider p-2">
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setOpen(false)}>
              Fechar
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </EtiquetasContext.Provider>
  );
}

function WaEtiquetasResumoTrigger() {
  const { resumo, setOpen, disabled } = useEtiquetasContext();
  if (!resumo) return null;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setOpen(true)}
      className={cn(
        "max-w-full truncate text-left text-xs text-wa-text-muted transition-colors",
        !disabled && "hover:text-wa-text",
      )}
    >
      {resumo}
    </button>
  );
}

function WaEtiquetasIconTrigger() {
  const { ativas, disabled } = useEtiquetasContext();

  return (
    <PopoverTrigger asChild>
      <WaIconButton label="Etiquetas" disabled={disabled} className="relative">
        <Tag className="h-5 w-5" />
        {ativas.length > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-wa-primary px-1 text-[10px] font-medium text-white">
            {ativas.length}
          </span>
        ) : null}
      </WaIconButton>
    </PopoverTrigger>
  );
}

export const WaEtiquetasPopover = Object.assign(WaEtiquetasPopoverRoot, {
  Resumo: WaEtiquetasResumoTrigger,
  Icone: WaEtiquetasIconTrigger,
});

export { formatarResumoEtiquetas };
