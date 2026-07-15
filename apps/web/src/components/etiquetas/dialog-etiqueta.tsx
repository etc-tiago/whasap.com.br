import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@whasap/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@whasap/ui/components/dialog";
import { Input } from "@whasap/ui/components/input";
import { Label } from "@whasap/ui/components/label";
import { cn } from "@whasap/ui/lib/utils";
import { useEffect, useState, type FormEvent } from "react";

import { invalidarEtiquetas } from "@/components/etiquetas/invalidar-etiquetas";
import { orpc } from "@/lib/orpc";
import { getOrpcErrorMessage } from "@/lib/orpc-error";

/** Paleta alinhada ao WhatsApp / Evolution (`CORES_WHATSAPP`). */
const CORES_ETIQUETA = [
  "#ff9485",
  "#64c4ff",
  "#ffd429",
  "#dfaef0",
  "#99d8ff",
  "#83e421",
  "#ffaf04",
  "#ff6b6b",
  "#7fd4c9",
  "#ff8cc8",
] as const;

type DialogEtiquetaProps = {
  organizacaoHash: string;
  aberto: boolean;
  onAbertoChange: (aberto: boolean) => void;
  /** null = criar; com id = editar */
  etiqueta: { id: string; nome: string; cor: string | null } | null;
  onCriada?: (id: string) => void;
};

export function DialogEtiqueta({
  organizacaoHash,
  aberto,
  onAbertoChange,
  etiqueta,
  onCriada,
}: DialogEtiquetaProps) {
  const queryClient = useQueryClient();
  const editando = etiqueta != null;
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState<string | null>(CORES_ETIQUETA[0]);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) return;
    setNome(etiqueta?.nome ?? "");
    setCor(etiqueta?.cor ?? CORES_ETIQUETA[0]);
    setErro(null);
  }, [aberto, etiqueta]);

  const criar = useMutation(
    orpc.caixaEntrada.etiquetas.criar.mutationOptions({
      onSuccess: (criada) => {
        invalidarEtiquetas(queryClient, organizacaoHash);
        onAbertoChange(false);
        onCriada?.(criada.id);
      },
      onError: (e) => setErro(getOrpcErrorMessage(e, "Não foi possível criar a etiqueta")),
    }),
  );

  const atualizar = useMutation(
    orpc.caixaEntrada.etiquetas.atualizar.mutationOptions({
      onSuccess: () => {
        invalidarEtiquetas(queryClient, organizacaoHash);
        onAbertoChange(false);
      },
      onError: (e) => setErro(getOrpcErrorMessage(e, "Não foi possível atualizar a etiqueta")),
    }),
  );

  const pendente = criar.isPending || atualizar.isPending;

  function salvar(e: FormEvent) {
    e.preventDefault();
    const nomeTrim = nome.trim();
    if (!nomeTrim) {
      setErro("Informe um nome");
      return;
    }
    setErro(null);
    if (editando) {
      atualizar.mutate({
        organizacaoHash,
        etiquetaId: etiqueta.id,
        nome: nomeTrim,
        cor,
      });
      return;
    }
    criar.mutate({
      organizacaoHash,
      nome: nomeTrim,
      cor,
    });
  }

  return (
    <Dialog open={aberto} onOpenChange={onAbertoChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={salvar}>
          <DialogHeader>
            <DialogTitle>{editando ? "Editar etiqueta" : "Nova etiqueta"}</DialogTitle>
            <DialogDescription>
              {editando
                ? "Altere o nome ou a cor da etiqueta."
                : "Crie uma etiqueta para organizar contatos."}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="etiqueta-nome">Nome</Label>
              <Input
                id="etiqueta-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                maxLength={100}
                placeholder="Ex.: VIP, Orçamento…"
                disabled={pendente}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {CORES_ETIQUETA.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    disabled={pendente}
                    aria-label={`Cor ${hex}`}
                    onClick={() => setCor(hex)}
                    className={cn(
                      "size-7 rounded-full border-2 transition-transform",
                      cor === hex
                        ? "scale-110 border-wa-text"
                        : "border-transparent hover:scale-105",
                    )}
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
            </div>

            {erro ? <p className="text-sm text-destructive">{erro}</p> : null}
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="ghost"
              disabled={pendente}
              onClick={() => onAbertoChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pendente || !nome.trim()}>
              {editando ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
