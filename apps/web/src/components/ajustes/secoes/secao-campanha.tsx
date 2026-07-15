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
import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";

import { CAMPANHA_ARTIGO_URL } from "@/lib/campanha";
import { orgInput } from "@/lib/org-input";
import { orpc } from "@/lib/orpc";
import { getOrpcErrorMessage } from "@/lib/orpc-error";
import { useOrganizacaoHash } from "@/lib/use-organizacao-hash";

/** Seção Campanha do modal de Ajustes — ativação e limites (admin). */
export function SecaoAjustesCampanha() {
  const organizacaoHash = useOrganizacaoHash();
  const queryClient = useQueryClient();

  const org = useQuery(
    orpc.organizacao.obter.queryOptions({
      input: orgInput(organizacaoHash),
    }),
  );
  const isAdmin = org.data?.meuPapel === "admin";

  const [habilitada, setHabilitada] = useState(false);
  const [limiteMinuto, setLimiteMinuto] = useState("10");
  const [limiteHora, setLimiteHora] = useState("60");
  const [alertaConsecutivos, setAlertaConsecutivos] = useState("5");

  useEffect(() => {
    if (!org.data) return;
    setHabilitada(org.data.campanhaHabilitada);
    setLimiteMinuto(String(org.data.campanhaLimitePorMinuto));
    setLimiteHora(String(org.data.campanhaLimitePorHora));
    setAlertaConsecutivos(String(org.data.campanhaAlertaConsecutivos));
  }, [org.data]);

  async function invalidarOrg() {
    if (!organizacaoHash) return;
    await queryClient.invalidateQueries({
      queryKey: orpc.organizacao.obter.key({ input: { organizacaoHash } }),
    });
  }

  const salvarHabilitada = useMutation(
    orpc.organizacao.atualizar.mutationOptions({
      onError: () => {
        setHabilitada(org.data?.campanhaHabilitada ?? false);
      },
      onSuccess: async () => {
        await invalidarOrg();
      },
    }),
  );

  const salvarLimites = useMutation(
    orpc.organizacao.atualizar.mutationOptions({
      onSuccess: async () => {
        await invalidarOrg();
      },
    }),
  );

  if (!organizacaoHash) return null;

  return (
    <div className="w-full space-y-6 p-6">
      <div>
        <h2 className="text-lg font-semibold">Campanha</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Módulo de envio rápido (opt-in). Por padrão fica desativado. Use com cautela — envios em
          massa podem levar ao bloqueio do número.
        </p>
        <a
          href={CAMPANHA_ARTIGO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          Ler riscos e boas práticas
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {!isAdmin ? (
        <p className="text-sm text-muted-foreground">
          Apenas administradores podem ativar o módulo de campanha.
        </p>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Ativar módulo</CardTitle>
              <CardDescription>
                Quando ativo, aparece o ícone na barra lateral e o painel de envio nas conversas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="campanha-habilitada" className="text-sm font-normal">
                  Campanha habilitada
                </Label>
                <Switch
                  id="campanha-habilitada"
                  checked={habilitada}
                  disabled={salvarHabilitada.isPending}
                  onCheckedChange={(checked) => {
                    setHabilitada(checked);
                    salvarHabilitada.mutate({
                      organizacaoHash,
                      campanhaHabilitada: checked,
                    });
                  }}
                />
              </div>
              {salvarHabilitada.error ? (
                <p className="text-sm text-destructive">
                  {getOrpcErrorMessage(salvarHabilitada.error, "Não foi possível salvar.")}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Limites de volume</CardTitle>
              <CardDescription>
                Soft-block no servidor (0 = sem limite) e alerta amigável após N envios em pouco
                tempo. Ajuste conforme o uso seguro da sua operação.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="campanha-limite-minuto">Por minuto</Label>
                  <Input
                    id="campanha-limite-minuto"
                    type="number"
                    min={0}
                    max={1000}
                    value={limiteMinuto}
                    onChange={(e) => setLimiteMinuto(e.target.value)}
                    disabled={salvarLimites.isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="campanha-limite-hora">Por hora</Label>
                  <Input
                    id="campanha-limite-hora"
                    type="number"
                    min={0}
                    max={10000}
                    value={limiteHora}
                    onChange={(e) => setLimiteHora(e.target.value)}
                    disabled={salvarLimites.isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="campanha-alerta">Alerta consecutivos</Label>
                  <Input
                    id="campanha-alerta"
                    type="number"
                    min={1}
                    max={1000}
                    value={alertaConsecutivos}
                    onChange={(e) => setAlertaConsecutivos(e.target.value)}
                    disabled={salvarLimites.isPending}
                  />
                </div>
              </div>
              <Button
                size="sm"
                disabled={salvarLimites.isPending || !habilitada}
                onClick={() =>
                  salvarLimites.mutate({
                    organizacaoHash,
                    campanhaLimitePorMinuto: Number.parseInt(limiteMinuto, 10) || 0,
                    campanhaLimitePorHora: Number.parseInt(limiteHora, 10) || 0,
                    campanhaAlertaConsecutivos: Number.parseInt(alertaConsecutivos, 10) || 5,
                  })
                }
              >
                {salvarLimites.isPending ? "Salvando…" : "Salvar limites"}
              </Button>
              {salvarLimites.error ? (
                <p className="text-sm text-destructive">
                  {getOrpcErrorMessage(salvarLimites.error, "Não foi possível salvar.")}
                </p>
              ) : null}
              {salvarLimites.isSuccess ? (
                <p className="text-sm text-muted-foreground">Limites salvos.</p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
