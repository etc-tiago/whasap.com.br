import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ICONE_CONEXAO_PADRAO, rotuloWhatsApp, type IconeConexao } from "@whasap/config";
import { Badge } from "@whasap/ui/components/badge";
import { Button } from "@whasap/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@whasap/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@whasap/ui/components/dialog";
import { useState } from "react";

import { ConexaoIdentidadeFields } from "@/components/conexao-identidade-fields";
import { IconeConexaoLucide } from "@/lib/icones-conexao";
import {
  instanciaOperacional,
  instanciaPrecisaConexao,
  instanciasParaReconectar,
  rotulosStatusInstancia,
} from "@/lib/instancia-status";
import { orgInput } from "@/lib/org-input";
import { orpc, type InstanciaItem } from "@/lib/orpc";
import { useOrganizacaoHash } from "@/lib/use-organizacao-hash";

export const Route = createFileRoute("/_panel/$organizacaoHash/instancias")({
  component: InstancesPage,
});

function InstancesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const organizacaoHash = useOrganizacaoHash();

  const [editando, setEditando] = useState<InstanciaItem | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editIcone, setEditIcone] = useState<IconeConexao>(ICONE_CONEXAO_PADRAO);

  const org = useQuery(
    orpc.organizacao.obter.queryOptions({
      input: orgInput(organizacaoHash),
    }),
  );

  const instances = useQuery(
    orpc.instancia.lista.queryOptions({
      input: orgInput(organizacaoHash),
    }),
  );

  const atualizar = useMutation(
    orpc.instancia.atualizar.mutationOptions({
      onSuccess: async () => {
        if (!organizacaoHash) return;
        await queryClient.invalidateQueries({
          queryKey: orpc.instancia.lista.key({ input: { organizacaoHash } }),
        });
        setEditando(null);
      },
    }),
  );

  const isAdmin = org.data?.meuPapel === "admin";
  const lista = instances.data ?? [];
  const paraReconectar = instanciasParaReconectar(lista);
  const conectadas = lista.filter((i) => instanciaOperacional(i.status));

  function abrirEdicao(inst: InstanciaItem) {
    setEditando(inst);
    setEditNome(inst.nome);
    setEditIcone((inst.icone as IconeConexao) || ICONE_CONEXAO_PADRAO);
  }

  function salvarEdicao() {
    if (!editando || editNome.trim().length < 2) return;
    atualizar.mutate({
      instanciaId: editando.id,
      nome: editNome.trim(),
      icone: editIcone,
    });
  }

  if (!organizacaoHash) return null;

  return (
    <div className="h-full space-y-6 overflow-auto p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">WhatsApp</h1>
          <p className="text-sm text-muted-foreground">
            {lista.length} no total — {conectadas.length} conectada
            {conectadas.length === 1 ? "" : "s"}
            {paraReconectar.length > 0 && `, ${paraReconectar.length} aguardando conexão`}
          </p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            {paraReconectar.length > 0 && (
              <Button
                onClick={() =>
                  navigate({
                    to: "/$organizacaoHash/integracao",
                    params: { organizacaoHash },
                    search: { instance: "", step: "", modo: "" },
                  })
                }
              >
                Reconectar WhatsApp
              </Button>
            )}
            <Button
              variant={paraReconectar.length > 0 ? "outline" : "default"}
              onClick={() =>
                navigate({
                  to: "/$organizacaoHash/integracao",
                  params: { organizacaoHash },
                  search: { instance: "", step: "", modo: "novo" },
                })
              }
            >
              Adicionar WhatsApp
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4">
        {lista.map((inst: InstanciaItem) => (
          <Card key={inst.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <IconeConexaoLucide nome={inst.icone} className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <CardTitle className="text-base">{inst.nome}</CardTitle>
                  <p className="text-xs text-muted-foreground">{rotuloWhatsApp(inst.provider)}</p>
                </div>
              </div>
              <div className="flex gap-2">
                {inst.trialEndsAt && new Date(inst.trialEndsAt) > new Date() && (
                  <Badge variant="secondary">Trial</Badge>
                )}
                <Badge variant={instanciaOperacional(inst.status) ? "default" : "outline"}>
                  {rotulosStatusInstancia[inst.status] ?? inst.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {isAdmin ? (
                <Button size="sm" variant="ghost" onClick={() => abrirEdicao(inst)}>
                  Editar nome/ícone
                </Button>
              ) : null}
              {instanciaPrecisaConexao(inst.status) && (
                <Button asChild size="sm" variant="outline">
                  <Link
                    to="/$organizacaoHash/integracao"
                    params={{ organizacaoHash }}
                    search={{ instance: inst.id, step: "", modo: "" }}
                  >
                    Reconectar
                  </Link>
                </Button>
              )}
              {instanciaOperacional(inst.status) && (
                <Button
                  asChild
                  size="sm"
                  variant={inst.asaasSubscriptionId ? "default" : "outline"}
                >
                  <Link to="/$organizacaoHash/inbox" params={{ organizacaoHash }}>
                    Abrir conversas
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
        {lista.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum WhatsApp cadastrado ainda.{" "}
            <Link
              to="/$organizacaoHash/integracao"
              params={{ organizacaoHash }}
              search={{ instance: "", step: "", modo: "novo" }}
              className="text-wa-green underline"
            >
              Adicione o primeiro
            </Link>
            .
          </p>
        )}
      </div>

      <Dialog open={Boolean(editando)} onOpenChange={(open) => !open && setEditando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar conexão</DialogTitle>
          </DialogHeader>
          <ConexaoIdentidadeFields
            nome={editNome}
            icone={editIcone}
            onNomeChange={setEditNome}
            onIconeChange={setEditIcone}
            disabled={atualizar.isPending}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditando(null)}
              disabled={atualizar.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={salvarEdicao}
              disabled={atualizar.isPending || editNome.trim().length < 2}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
