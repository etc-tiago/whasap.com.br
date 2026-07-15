import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@whasap/ui/components/alert-dialog";
import { Badge } from "@whasap/ui/components/badge";
import { Button } from "@whasap/ui/components/button";
import { ChevronLeft, ChevronRight, MessageCircle, Pencil, Trash2, UserRound } from "lucide-react";
import { useState } from "react";

import { DialogEtiqueta } from "@/components/etiquetas/dialog-etiqueta";
import { invalidarEtiquetas } from "@/components/etiquetas/invalidar-etiquetas";
import { IconeConexaoLucide } from "@/lib/icones-conexao";
import { orgInput } from "@/lib/org-input";
import { orpc } from "@/lib/orpc";
import { getOrpcErrorMessage } from "@/lib/orpc-error";

const LIMITE_PAGINA = 30;

function formatarData(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

type DetalheEtiquetaProps = {
  organizacaoHash: string;
  etiquetaId: string;
  podeEditar: boolean;
  onExcluida: () => void;
  onVoltar?: () => void;
};

export function DetalheEtiqueta({
  organizacaoHash,
  etiquetaId,
  podeEditar,
  onExcluida,
  onVoltar,
}: DetalheEtiquetaProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pagina, setPagina] = useState(0);
  const [dialogEditar, setDialogEditar] = useState(false);
  const [confirmExcluir, setConfirmExcluir] = useState(false);

  const detalhe = useQuery(
    orpc.caixaEntrada.etiquetas.obter.queryOptions({
      input: orgInput(organizacaoHash, { etiquetaId }),
    }),
  );

  const contatos = useQuery(
    orpc.caixaEntrada.etiquetas.contatos.queryOptions({
      input: orgInput(organizacaoHash, {
        etiquetaId,
        limite: LIMITE_PAGINA,
        offset: pagina * LIMITE_PAGINA,
      }),
    }),
  );

  const excluir = useMutation(
    orpc.caixaEntrada.etiquetas.excluir.mutationOptions({
      onSuccess: () => {
        invalidarEtiquetas(queryClient, organizacaoHash);
        setConfirmExcluir(false);
        onExcluida();
      },
    }),
  );

  function entrarEmContato(contato: NonNullable<typeof contatos.data>["itens"][number]) {
    if (contato.conversaAberta) {
      void navigate({
        to: "/$organizacaoHash/chat/$conversaId",
        params: { organizacaoHash, conversaId: contato.conversaAberta.id },
      });
      return;
    }
    const instanciaId = contato.instancias[0]?.id ?? "";
    void navigate({
      to: "/$organizacaoHash/inbox",
      params: { organizacaoHash },
      search: {
        telefone: contato.telefone ?? undefined,
        instancia: instanciaId || undefined,
      },
    });
  }

  if (detalhe.isPending) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-sm text-wa-text-muted">Carregando etiqueta…</p>
      </div>
    );
  }

  if (detalhe.isError || !detalhe.data) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-sm text-destructive">
          {getOrpcErrorMessage(detalhe.error, "Etiqueta não encontrada")}
        </p>
      </div>
    );
  }

  const etiqueta = detalhe.data;
  const total = contatos.data?.total ?? etiqueta.contatosContagem;
  const totalPaginas = Math.max(1, Math.ceil(total / LIMITE_PAGINA));
  const itens = contatos.data?.itens ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-wa-divider px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            {onVoltar ? (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="md:hidden"
                aria-label="Voltar"
                onClick={onVoltar}
              >
                <ChevronLeft className="size-5" />
              </Button>
            ) : null}
            <span
              className="size-4 shrink-0 rounded-full"
              style={{ backgroundColor: etiqueta.cor ?? "var(--wa-primary)" }}
            />
            <h2 className="truncate text-xl font-semibold text-wa-text">{etiqueta.nome}</h2>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-wa-text-muted">
            <span>{total === 1 ? "1 contato" : `${total} contatos`}</span>
            <span aria-hidden>·</span>
            <span>Criada em {formatarData(etiqueta.criadoEm)}</span>
            {etiqueta.sincronizadaWhatsapp ? (
              <Badge
                variant="secondary"
                className="border-0 bg-wa-chip-active text-[10px] font-medium text-wa-green-dark"
              >
                WhatsApp
              </Badge>
            ) : null}
          </div>
        </div>

        {podeEditar ? (
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setDialogEditar(true)}
            >
              <Pencil className="mr-1.5 size-3.5" />
              Editar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmExcluir(true)}
            >
              <Trash2 className="mr-1.5 size-3.5" />
              Excluir
            </Button>
          </div>
        ) : null}
      </div>

      <div className="wa-scroll min-h-0 flex-1 overflow-y-auto">
        {contatos.isPending ? (
          <p className="px-5 py-10 text-center text-sm text-wa-text-muted">Carregando contatos…</p>
        ) : itens.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-wa-text-muted">
            Nenhum contato com esta etiqueta.
          </p>
        ) : (
          <ul className="divide-y divide-wa-divider">
            {itens.map((contato) => (
              <li
                key={contato.id}
                className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-wa-hover"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-wa-chip text-wa-icon">
                  <UserRound className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-wa-text">
                    {contato.nome?.trim() || contato.telefone || "Sem nome"}
                  </p>
                  <p className="truncate text-sm text-wa-text-muted">{contato.telefone ?? "—"}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {contato.instancias.map((inst) => (
                      <Badge
                        key={inst.id}
                        variant="outline"
                        className="inline-flex max-w-40 items-center gap-1 truncate text-[10px]"
                      >
                        <IconeConexaoLucide nome={inst.icone} className="size-3 shrink-0" />
                        <span className="truncate">{inst.nome}</span>
                      </Badge>
                    ))}
                    {contato.conversaAberta ? (
                      <Badge className="bg-wa-chip-active text-[10px] font-medium text-wa-green-dark">
                        Em atendimento
                        {contato.conversaAberta.usuarioAtribuidoNome
                          ? `: ${contato.conversaAberta.usuarioAtribuidoNome}`
                          : ""}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="gap-1"
                  onClick={() => entrarEmContato(contato)}
                >
                  <MessageCircle className="size-3.5" />
                  Conversar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {total > LIMITE_PAGINA ? (
        <div className="flex items-center justify-between gap-3 border-t border-wa-divider px-5 py-3">
          <p className="text-xs text-wa-text-muted">
            Página {pagina + 1} de {totalPaginas}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={pagina === 0}
              onClick={() => setPagina((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={pagina + 1 >= totalPaginas}
              onClick={() => setPagina((p) => p + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      ) : null}

      <DialogEtiqueta
        organizacaoHash={organizacaoHash}
        aberto={dialogEditar}
        onAbertoChange={setDialogEditar}
        etiqueta={{ id: etiqueta.id, nome: etiqueta.nome, cor: etiqueta.cor }}
      />

      <AlertDialog open={confirmExcluir} onOpenChange={setConfirmExcluir}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir etiqueta?</AlertDialogTitle>
            <AlertDialogDescription>
              A etiqueta &ldquo;{etiqueta.nome}&rdquo; será removida de todos os contatos. Esta ação
              não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {excluir.isError ? (
            <p className="text-sm text-destructive">
              {getOrpcErrorMessage(excluir.error, "Não foi possível excluir")}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluir.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={excluir.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                excluir.mutate({ organizacaoHash, etiquetaId });
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
