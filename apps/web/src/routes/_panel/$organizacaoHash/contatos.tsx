/**
 * Contatos da organização — lista paginada com CRUD e atalho para conversar.
 *
 * Mostra instâncias vinculadas e o atendente da conversa ainda aberta.
 * RBAC: analistas só leem; admin/usuario criam, editam e removem.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { skipToken, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@whasap/ui/components/dialog";
import { Input } from "@whasap/ui/components/input";
import { Label } from "@whasap/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@whasap/ui/components/select";
import { MessageCircle, Pencil, Plus, Search, Trash2, UserRound } from "lucide-react";
import { useMemo, useState } from "react";

import { IconeConexaoLucide } from "@/lib/icones-conexao";
import { instanciaOperacional } from "@/lib/instancia-status";
import { orgInput } from "@/lib/org-input";
import { orpc, type ContatoListaItem } from "@/lib/orpc";
import { getOrpcErrorMessage } from "@/lib/orpc-error";
import { normalizarTelefoneBr } from "@/lib/telefone-br";
import { useOrganizacaoHash } from "@/lib/use-organizacao-hash";

const LIMITE_PAGINA = 30;

export const Route = createFileRoute("/_panel/$organizacaoHash/contatos")({
  component: ContatosPage,
});

function ContatosPage() {
  const organizacaoHash = useOrganizacaoHash();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [instanciaFiltro, setInstanciaFiltro] = useState<string>("__todas__");
  const [pagina, setPagina] = useState(0);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [editando, setEditando] = useState<ContatoListaItem | null>(null);
  const [removendo, setRemovendo] = useState<ContatoListaItem | null>(null);
  const [nomeForm, setNomeForm] = useState("");
  const [telefoneForm, setTelefoneForm] = useState("");
  const [instanciaForm, setInstanciaForm] = useState("");
  const [erroForm, setErroForm] = useState<string | null>(null);

  const org = useQuery(
    orpc.organizacao.obter.queryOptions({
      input: orgInput(organizacaoHash),
    }),
  );

  const instancias = useQuery(
    orpc.instancia.lista.queryOptions({
      input: orgInput(organizacaoHash),
    }),
  );

  const instanciasOperacionais = useMemo(
    () => (instancias.data ?? []).filter((i) => instanciaOperacional(i.status)),
    [instancias.data],
  );

  const podeEscrever = org.data?.meuPapel === "admin" || org.data?.meuPapel === "usuario";

  const listaInput = useMemo(() => {
    if (!organizacaoHash) return null;
    return {
      organizacaoHash,
      busca: buscaAplicada || undefined,
      instanciaId: instanciaFiltro === "__todas__" ? undefined : instanciaFiltro,
      limite: LIMITE_PAGINA,
      offset: pagina * LIMITE_PAGINA,
    };
  }, [organizacaoHash, buscaAplicada, instanciaFiltro, pagina]);

  const contatos = useQuery(
    orpc.caixaEntrada.contatos.lista.queryOptions({
      input: listaInput ?? skipToken,
    }),
  );

  const invalidarLista = () => {
    if (!listaInput) return;
    queryClient.invalidateQueries({
      queryKey: orpc.caixaEntrada.contatos.lista.key(),
    });
  };

  const criar = useMutation(
    orpc.caixaEntrada.contatos.criar.mutationOptions({
      onSuccess: () => {
        setDialogAberto(false);
        resetForm();
        invalidarLista();
      },
      onError: (err) => setErroForm(getOrpcErrorMessage(err, "Não foi possível salvar o contato.")),
    }),
  );

  const atualizar = useMutation(
    orpc.caixaEntrada.contatos.atualizar.mutationOptions({
      onSuccess: () => {
        setDialogAberto(false);
        setEditando(null);
        resetForm();
        invalidarLista();
      },
      onError: (err) =>
        setErroForm(getOrpcErrorMessage(err, "Não foi possível atualizar o contato.")),
    }),
  );

  const remover = useMutation(
    orpc.caixaEntrada.contatos.remover.mutationOptions({
      onSuccess: () => {
        setRemovendo(null);
        invalidarLista();
      },
    }),
  );

  function resetForm() {
    setNomeForm("");
    setTelefoneForm("");
    setInstanciaForm("");
    setErroForm(null);
  }

  function abrirCriar() {
    setEditando(null);
    resetForm();
    setInstanciaForm(instanciasOperacionais[0]?.id ?? "");
    setDialogAberto(true);
  }

  function abrirEditar(contato: ContatoListaItem) {
    setEditando(contato);
    setNomeForm(contato.nome ?? "");
    setTelefoneForm(contato.telefone ?? "");
    setInstanciaForm("");
    setErroForm(null);
    setDialogAberto(true);
  }

  function aplicarBusca() {
    setPagina(0);
    setBuscaAplicada(busca.trim());
  }

  function entrarEmContato(contato: ContatoListaItem) {
    if (!organizacaoHash) return;
    if (contato.conversaAberta) {
      void navigate({
        to: "/$organizacaoHash/inbox",
        params: { organizacaoHash },
        search: { conversa: contato.conversaAberta.id },
      });
      return;
    }
    const instanciaId = contato.instancias[0]?.id ?? instanciasOperacionais[0]?.id ?? "";
    void navigate({
      to: "/$organizacaoHash/inbox",
      params: { organizacaoHash },
      search: {
        telefone: contato.telefone ?? undefined,
        instancia: instanciaId || undefined,
      },
    });
  }

  function salvar() {
    setErroForm(null);
    if (editando) {
      atualizar.mutate({ contatoId: editando.id, nome: nomeForm });
      return;
    }
    if (!organizacaoHash || !instanciaForm) {
      setErroForm("Selecione uma conexão");
      return;
    }
    const telefone = normalizarTelefoneBr(telefoneForm);
    if (telefone.length < 8) {
      setErroForm("Informe um telefone válido");
      return;
    }
    criar.mutate({
      organizacaoHash,
      instanciaId: instanciaForm,
      telefone,
      nome: nomeForm.trim() || undefined,
    });
  }

  const total = contatos.data?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / LIMITE_PAGINA));
  const itens = contatos.data?.itens ?? [];

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-wa-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-wa-divider px-5 py-4">
        <div>
          <h1 className="text-2xl font-semibold text-wa-text">Contatos</h1>
          <p className="text-sm text-wa-text-muted">
            {total === 1 ? "1 contato" : `${total} contatos`} na organização
          </p>
        </div>
        {podeEscrever ? (
          <Button type="button" onClick={abrirCriar} className="gap-1.5">
            <Plus className="size-4" />
            Novo contato
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end gap-3 border-b border-wa-divider px-5 py-3">
        <div className="min-w-48 flex-1">
          <Label htmlFor="busca-contato" className="sr-only">
            Buscar
          </Label>
          <div className="flex items-center gap-2 rounded-full bg-wa-input px-3 py-2">
            <Search className="size-4 text-wa-icon" />
            <input
              id="busca-contato"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") aplicarBusca();
              }}
              placeholder="Buscar por nome ou telefone"
              className="flex-1 bg-transparent text-sm text-wa-text placeholder:text-wa-text-muted focus:outline-none"
            />
          </div>
        </div>
        <div className="w-52">
          <Label className="mb-1 block text-xs text-wa-text-muted">Conexão</Label>
          <Select
            value={instanciaFiltro}
            onValueChange={(v) => {
              setInstanciaFiltro(v);
              setPagina(0);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__todas__">Todas</SelectItem>
              {(instancias.data ?? []).map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" variant="secondary" onClick={aplicarBusca}>
          Buscar
        </Button>
      </div>

      <div className="wa-scroll min-h-0 flex-1 overflow-y-auto">
        {contatos.isPending ? (
          <p className="px-5 py-10 text-center text-sm text-wa-text-muted">Carregando contatos…</p>
        ) : itens.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-wa-text-muted">
            {buscaAplicada || instanciaFiltro !== "__todas__"
              ? "Nenhum contato encontrado com esses filtros."
              : "Nenhum contato ainda. Adicione o primeiro ou inicie uma conversa."}
          </p>
        ) : (
          <ul className="divide-y divide-wa-divider">
            {itens.map((contato) => (
              <li
                key={contato.id}
                className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-wa-hover"
              >
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-wa-chip text-wa-icon">
                  <UserRound className="size-5" />
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
                          : " (sem atendente)"}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
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
                  {podeEscrever ? (
                    <>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label="Editar contato"
                        onClick={() => abrirEditar(contato)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label="Remover contato"
                        onClick={() => setRemovendo(contato)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {total > LIMITE_PAGINA ? (
        <div className="flex items-center justify-between border-t border-wa-divider px-5 py-3">
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
              Anterior
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={pagina + 1 >= totalPaginas}
              onClick={() => setPagina((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog
        open={dialogAberto}
        onOpenChange={(open) => {
          setDialogAberto(open);
          if (!open) {
            setEditando(null);
            resetForm();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editando ? "Editar contato" : "Novo contato"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="contato-nome">Nome</Label>
              <Input
                id="contato-nome"
                value={nomeForm}
                onChange={(e) => setNomeForm(e.target.value)}
                placeholder="Nome do contato"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contato-telefone">Telefone</Label>
              <Input
                id="contato-telefone"
                value={telefoneForm}
                onChange={(e) => setTelefoneForm(e.target.value)}
                placeholder="5511999999999"
                disabled={Boolean(editando)}
              />
              {editando ? (
                <p className="text-xs text-muted-foreground">O telefone não pode ser alterado.</p>
              ) : null}
            </div>
            {!editando ? (
              <div className="space-y-1.5">
                <Label>Conexão</Label>
                <Select value={instanciaForm} onValueChange={setInstanciaForm}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {instanciasOperacionais.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {erroForm ? <p className="text-sm text-destructive">{erroForm}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setDialogAberto(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={salvar}
              disabled={criar.isPending || atualizar.isPending}
            >
              {editando ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(removendo)} onOpenChange={(o) => !o && setRemovendo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover contato?</AlertDialogTitle>
            <AlertDialogDescription>
              {removendo
                ? `“${removendo.nome?.trim() || removendo.telefone || "Contato"}” será removido da lista. O histórico de conversas permanece.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (removendo) remover.mutate({ contatoId: removendo.id });
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
