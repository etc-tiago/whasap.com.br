import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@whasap/ui/lib/utils";
import { useEffect, useRef, useState } from "react";

import { orpc } from "@/lib/orpc";
import { getOrpcErrorMessage } from "@/lib/orpc-error";

type WaNomeContatoEditorProps = {
  contatoId: string;
  contatoNome: string | null;
  contatoTelefone: string;
  disabled?: boolean;
};

export function WaNomeContatoEditor({
  contatoId,
  contatoNome,
  contatoTelefone,
  disabled,
}: WaNomeContatoEditorProps) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(contatoNome ?? "");

  const nomeTrim = contatoNome?.trim() || null;
  const nomeExibido = nomeTrim ?? contatoTelefone;
  const mostrarTelefone = Boolean(nomeTrim);

  useEffect(() => {
    if (!editando) {
      setValor(contatoNome ?? "");
    }
  }, [contatoNome, editando]);

  useEffect(() => {
    if (editando) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editando]);

  const atualizarNome = useMutation(
    orpc.caixaEntrada.contatos.atualizarNome.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.caixaEntrada.conversas.lista.key(),
        });
        setEditando(false);
      },
    }),
  );

  function cancelar() {
    setValor(contatoNome ?? "");
    setEditando(false);
  }

  function salvar() {
    if (atualizarNome.isPending) return;
    const nome = valor.trim();
    const nomeAtual = (contatoNome ?? "").trim();
    if (nome === nomeAtual) {
      setEditando(false);
      return;
    }
    atualizarNome.mutate({ contatoId, nome });
  }

  function iniciarEdicao() {
    if (disabled) return;
    setValor(contatoNome ?? "");
    setEditando(true);
  }

  if (editando) {
    return (
      <div className="min-w-0">
        <input
          ref={inputRef}
          type="text"
          value={valor}
          disabled={atualizarNome.isPending}
          onChange={(e) => setValor(e.target.value)}
          onBlur={salvar}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              salvar();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              cancelar();
            }
          }}
          placeholder={contatoTelefone}
          className={cn(
            "w-full min-w-0 rounded border border-wa-divider bg-wa-input px-1.5 py-0.5",
            "text-[15px] font-medium text-wa-text outline-none focus:ring-1 focus:ring-wa-primary",
          )}
          aria-label="Nome do contato"
        />
        {atualizarNome.error ? (
          <p className="mt-0.5 text-xs text-destructive">
            {getOrpcErrorMessage(atualizarNome.error, "Erro ao salvar nome")}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <p
        onDoubleClick={iniciarEdicao}
        title={disabled ? undefined : "Duplo clique para editar o nome"}
        className={cn("truncate text-[15px] font-medium text-wa-text", !disabled && "cursor-text")}
      >
        {nomeExibido}
      </p>
      {mostrarTelefone ? (
        <p className="truncate text-xs text-wa-text-muted">{contatoTelefone}</p>
      ) : null}
    </div>
  );
}
