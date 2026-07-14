import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@whasap/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@whasap/ui/components/card";
import { Input } from "@whasap/ui/components/input";
import { Label } from "@whasap/ui/components/label";
import { Switch } from "@whasap/ui/components/switch";
import { useEffect, useState } from "react";

import { WaAcaoCard, invalidarAposAcao, useAcoesResumo } from "@/components/inbox/wa-acao-card";
import { orgInput } from "@/lib/org-input";
import { orpc, orpcClient } from "@/lib/orpc";
import { getOrpcErrorMessage } from "@/lib/orpc-error";
import { useOrganizacaoHash } from "@/lib/use-organizacao-hash";

export const Route = createFileRoute("/_panel/$organizacaoHash/acoes/automacao")({
  component: AcoesAutomacaoPage,
});

function AcoesAutomacaoPage() {
  const organizacaoHash = useOrganizacaoHash();
  const queryClient = useQueryClient();

  const org = useQuery(
    orpc.organizacao.obter.queryOptions({
      input: orgInput(organizacaoHash),
    }),
  );
  const resumo = useQuery(useAcoesResumo(organizacaoHash));
  const isAdmin = org.data?.meuPapel === "admin";
  const d = resumo.data;

  const [horas, setHoras] = useState("72");
  const [exibirNome, setExibirNome] = useState(false);

  useEffect(() => {
    const v = org.data?.horasAutoFecharInatividade ?? d?.horasAutoFecharInatividade;
    if (v) setHoras(v);
  }, [org.data?.horasAutoFecharInatividade, d?.horasAutoFecharInatividade]);

  useEffect(() => {
    if (org.data) setExibirNome(org.data.exibirNomeAtendenteMensagens);
  }, [org.data]);

  async function invalidarOrg() {
    await invalidarAposAcao(queryClient);
    if (!organizacaoHash) return;
    await queryClient.invalidateQueries({
      queryKey: orpc.organizacao.obter.key({ input: { organizacaoHash } }),
    });
  }

  const salvarHoras = useMutation(
    orpc.organizacao.atualizar.mutationOptions({
      onSuccess: async () => {
        await invalidarOrg();
      },
    }),
  );

  const salvarNome = useMutation(
    orpc.organizacao.atualizar.mutationOptions({
      onError: () => {
        setExibirNome(org.data?.exibirNomeAtendenteMensagens ?? false);
      },
      onSuccess: async () => {
        await invalidarOrg();
      },
    }),
  );

  if (!organizacaoHash) return null;

  return (
    <div className="max-w-2xl space-y-6 p-6">
      <div>
        <h2 className="text-lg font-semibold text-wa-text">Automação</h2>
        <p className="mt-1 text-sm text-wa-text-muted">
          Defina após quantas horas sem mensagem uma conversa em atendimento é fechada
          automaticamente (cron) e se o nome do atendente aparece nas mensagens enviadas.
        </p>
      </div>

      {!isAdmin ? (
        <p className="text-sm text-wa-text-muted">
          Apenas administradores podem alterar a automação.
        </p>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Auto-fechar por inatividade</CardTitle>
              <CardDescription>
                Conversas abertas sem mensagem nesse período são fechadas pelo agendamento do
                sistema.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 max-w-xs">
                <Label htmlFor="horas-auto-fechar">Horas sem mensagem</Label>
                <Input
                  id="horas-auto-fechar"
                  type="number"
                  min={1}
                  max={8760}
                  value={horas}
                  onChange={(e) => setHoras(e.target.value)}
                  disabled={salvarHoras.isPending}
                />
              </div>
              <Button
                size="sm"
                disabled={
                  salvarHoras.isPending || !horas || horas === org.data?.horasAutoFecharInatividade
                }
                onClick={() =>
                  salvarHoras.mutate({
                    organizacaoHash,
                    horasAutoFecharInatividade: horas,
                  })
                }
              >
                {salvarHoras.isPending ? "Salvando…" : "Salvar"}
              </Button>
              {salvarHoras.error ? (
                <p className="text-sm text-destructive">
                  {getOrpcErrorMessage(salvarHoras.error, "Não foi possível salvar.")}
                </p>
              ) : null}
              {salvarHoras.isSuccess ? (
                <p className="text-sm text-wa-text-muted">Configuração salva.</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Nome do atendente nas mensagens</CardTitle>
              <CardDescription>
                Quando ativo, o nome do atendente vai na primeira linha do texto ou da legenda
                enviados ao WhatsApp. Em áudio e figurinha, o nome é enviado como mensagem de texto
                imediatamente antes da mídia.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="exibir-nome-atendente" className="text-sm font-normal">
                  Exibir nome do atendente
                </Label>
                <Switch
                  id="exibir-nome-atendente"
                  checked={exibirNome}
                  disabled={salvarNome.isPending}
                  onCheckedChange={(checked) => {
                    setExibirNome(checked);
                    salvarNome.mutate({
                      organizacaoHash,
                      exibirNomeAtendenteMensagens: checked,
                    });
                  }}
                />
              </div>
              {salvarNome.error ? (
                <p className="text-sm text-destructive">
                  {getOrpcErrorMessage(salvarNome.error, "Não foi possível salvar.")}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <WaAcaoCard
            organizacaoHash={organizacaoHash}
            titulo="Aplicar agora"
            descricao={`Fecha agora as conversas inativas com o limiar atual (${horas || d?.horasAutoFecharInatividade || "72"}h), sem esperar o cron.`}
            contagem={d?.inativas ?? 0}
            rotuloBotao="Fechar inativas agora"
            variante="destructive"
            executar={(input) => orpcClient.acoes.finalizarInativas(input)}
          />
        </div>
      )}
    </div>
  );
}
