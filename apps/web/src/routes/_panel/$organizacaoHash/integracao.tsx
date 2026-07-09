/**
 * Wizard de onboarding: escolha de instância desconectada ou criação de nova conexão.
 * Estado de navegação via URL; dados remotos via React Query.
 */
import { skipToken, useMutation, useQuery, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Badge } from "@whasap/ui/components/badge";
import { Button } from "@whasap/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@whasap/ui/components/card";
import { Input } from "@whasap/ui/components/input";
import { Label } from "@whasap/ui/components/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@whasap/ui/components/tabs";
import { Check, Loader2, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";

import {
  isEvolutionProvider,
  rotuloSeuWhatsApp,
  rotuloWhatsApp,
  type InstanceProvider,
} from "@whasap/config";

import {
  instanciasParaReconectar,
  rotulosStatusInstancia,
} from "@/lib/instancia-status";
import { derivarPassoOnboarding, type PassoOnboarding } from "@/lib/onboarding";
import { orgInput } from "@/lib/org-input";
import { getOrpcErrorMessage } from "@/lib/orpc-error";
import { orpc, type InstanciaItem } from "@/lib/orpc";
import { useOrganizacaoHash } from "@/lib/use-organizacao-hash";

export const Route = createFileRoute("/_panel/$organizacaoHash/integracao")({
  validateSearch: (s: Record<string, unknown>) => ({
    instance: (s.instance as string) ?? "",
    step: (s.step as string) ?? "",
    modo: (s.modo as string) === "novo" ? "novo" : "",
  }),
  component: OnboardingPage,
});

type WizardStep = PassoOnboarding;
type InstanciaOnboarding = {
  provider: string;
  status: string;
  nome: string;
};

function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { instance: instanceId, step: searchStep, modo } = Route.useSearch();
  const organizacaoHash = useOrganizacaoHash();
  const modoNovo = modo === "novo";

  const [provider, setProvider] = useState<InstanceProvider>("evolution");
  const [cloudPhone, setCloudPhone] = useState("");
  const [cloudWaba, setCloudWaba] = useState("");
  const [cloudToken, setCloudToken] = useState("");
  const [nome, setNome] = useState("");

  const instancias = useQuery(
    orpc.instancia.lista.queryOptions({
      input: orgInput(organizacaoHash),
    }),
  );

  const instance = useQuery(
    orpc.instancia.obter.queryOptions({
      input: instanceId ? { instanciaId: instanceId } : skipToken,
    }),
  );

  const criar = useMutation(orpc.instancia.criar.mutationOptions());
  const provisionar = useMutation(
    orpc.instancia.provisionar.mutationOptions({
      retry: false,
      onSuccess: () => {
        void instance.refetch();
      },
    }),
  );
  const configurarCloud = useMutation(orpc.instancia.configurarCloud.mutationOptions());

  const inst = instance.data;
  const listaReconectar = instanciasParaReconectar(instancias.data ?? []);

  useEffect(() => {
    provisionar.reset();
  }, [instanceId, provisionar]);

  const wizardStep: WizardStep = derivarPassoOnboarding({
    searchStep,
    activeInstanceId: instanceId,
    modoNovo,
    temInstanciasParaReconectar: listaReconectar.length > 0,
    instancia: inst,
  });

  useEffect(() => {
    if (!organizacaoHash || !inst || searchStep === "concluido") return;
    if (inst.status === "connected") {
      navigate({
        to: "/$organizacaoHash/integracao",
        params: { organizacaoHash },
        search: { instance: "", step: "", modo: "" },
      });
    }
  }, [inst, navigate, organizacaoHash, searchStep]);

  const prontaParaQr = instanciaEvolutionProntaParaQr(
    inst,
    provisionar.isPending,
    provisionar.isSuccess,
  );

  const obterQr = useQuery(
    orpc.instancia.obterQr.queryOptions({
      input: instanceId ? { instanciaId: instanceId } : skipToken,
      enabled: Boolean(instanceId && prontaParaQr),
      retry: false,
      refetchInterval: (query) => {
        if (query.state.error) return false;
        if (query.state.data?.base64) return false;
        if (query.state.data?.estado === "open") return false;
        return 3000;
      },
    }),
  );

  const statusConexao = useQuery(
    orpc.instancia.statusConexao.queryOptions({
      input: instanceId ? { instanciaId: instanceId } : skipToken,
      enabled: Boolean(instanceId),
      refetchInterval: 3000,
    }),
  );

  const conectado = statusConexao.data?.conectado ?? false;

  useRedirecionarOnboardingConcluido(wizardStep, instanceId, organizacaoHash, navigate);

  useProvisionamentoEvolution({
    instanceId,
    inst,
    provisionar,
  });

  const qrBase64 = obterQr.data?.base64 ?? null;
  const pairingCode = obterQr.data?.pairingCode ?? null;
  const estadoQr = obterQr.data?.estado ?? null;
  const aguardandoQr =
    !qrBase64 &&
    !obterQr.isError &&
    !provisionar.isError &&
    !provisionar.isPending &&
    Boolean(obterQr.data);

  async function handleRegenerarQr() {
    if (!instanceId) return;
    provisionar.reset();
    await queryClient.invalidateQueries({
      queryKey: orpc.instancia.obterQr.key({ input: { instanciaId: instanceId } }),
    });
    await provisionar.mutateAsync({ instanciaId: instanceId });
  }

  function selecionarInstancia(id: string) {
    if (!organizacaoHash) return;
    navigate({
      to: "/$organizacaoHash/integracao",
      params: { organizacaoHash },
      search: { instance: id, step: "", modo: "" },
    });
  }

  async function handleCriarInstancia() {
    if (!organizacaoHash || !nome.trim()) return;
    const created = await criar.mutateAsync({
      organizacaoHash,
      nome,
      provider,
    });
    navigate({
      to: "/$organizacaoHash/integracao",
      params: { organizacaoHash },
      search: { instance: created.id, step: "", modo: "" },
    });
  }

  async function handleCloudManual() {
    if (!instanceId) return;
    await configurarCloud.mutateAsync({
      instanciaId: instanceId,
      phoneNumberId: cloudPhone,
      wabaId: cloudWaba,
      accessToken: cloudToken,
    });
    await instance.refetch();
    await statusConexao.refetch();
  }

  return (
    <div className="relative mx-auto max-w-lg space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Configurar</h1>
        <p className="text-sm text-muted-foreground">
          {subtituloPassoOnboarding(wizardStep, inst?.provider)}
        </p>
      </div>

      {wizardStep === "escolher" && (
        <Card>
          <CardHeader>
            <CardTitle>Escolha o WhatsApp para reconectar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Selecione uma instância desconectada para gerar um novo QR Code.
            </p>
            <div className="space-y-2">
              {listaReconectar.map((item: InstanciaItem) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selecionarInstancia(item.id)}
                  className="flex w-full items-center justify-between rounded-lg border p-4 text-left transition hover:border-wa-green hover:bg-wa-green/5"
                >
                  <div>
                    <p className="font-medium">{item.nome}</p>
                    <p className="text-xs text-muted-foreground">{rotuloWhatsApp(item.provider)}</p>
                  </div>
                  <Badge variant="outline">
                    {rotulosStatusInstancia[item.status] ?? item.status}
                  </Badge>
                </button>
              ))}
            </div>
            {organizacaoHash && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() =>
                  navigate({
                    to: "/$organizacaoHash/integracao",
                    params: { organizacaoHash },
                    search: { instance: "", step: "", modo: "novo" },
                  })
                }
              >
                Adicionar novo WhatsApp
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {wizardStep === "tipo" && (
        <Card>
          <CardHeader>
            <CardTitle>Tipo de conexão</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setProvider("evolution")}
                className={`rounded-lg border p-4 text-left transition ${
                  provider === "evolution" ? "border-wa-green bg-wa-green/5" : "border-border"
                }`}
              >
                <Smartphone className="mb-2 h-5 w-5" />
                <p className="font-medium">{rotuloWhatsApp("evolution")}</p>
                <p className="text-xs text-muted-foreground">Conexão via QR Code</p>
              </button>
              <button
                type="button"
                onClick={() => setProvider("cloud_api")}
                className={`rounded-lg border p-4 text-left transition ${
                  provider === "cloud_api" ? "border-wa-green bg-wa-green/5" : "border-border"
                }`}
              >
                <Smartphone className="mb-2 h-5 w-5" />
                <p className="font-medium">{rotuloWhatsApp("cloud_api")}</p>
                <p className="text-xs text-muted-foreground">API oficial da Meta</p>
              </button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Atendimento"
              />
            </div>
            <Button
              className="w-full"
              disabled={!nome.trim() || criar.isPending}
              onClick={handleCriarInstancia}
            >
              Continuar
            </Button>
            {listaReconectar.length > 0 && organizacaoHash && (
              <Button
                variant="ghost"
                className="w-full"
                onClick={() =>
                  navigate({
                    to: "/$organizacaoHash/integracao",
                    params: { organizacaoHash },
                    search: { instance: "", step: "", modo: "" },
                  })
                }
              >
                Voltar para reconexão
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {wizardStep === "conexao" && inst && (
        <Card>
          <CardHeader>
            <CardTitle>Conectar WhatsApp</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              <strong>{inst.nome}</strong> — {rotuloSeuWhatsApp(inst.provider)}
            </p>

            {isEvolutionProvider(inst.provider) && (
              <>
                {provisionar.isError ? (
                  <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-destructive/30 bg-destructive/5 px-4">
                    <p className="text-center text-sm text-destructive">
                      {getOrpcErrorMessage(
                        provisionar.error,
                        "Não foi possível provisionar a instância.",
                      )}
                    </p>
                  </div>
                ) : obterQr.isError ? (
                  <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-destructive/30 bg-destructive/5 px-4">
                    <p className="text-center text-sm text-destructive">
                      {getOrpcErrorMessage(obterQr.error, "Não foi possível gerar o QR Code.")}
                    </p>
                  </div>
                ) : qrBase64 ? (
                  <div className="space-y-2">
                    <img
                      src={
                        qrBase64.startsWith("data:")
                          ? qrBase64
                          : `data:image/png;base64,${qrBase64}`
                      }
                      alt="QR Code WhatsApp"
                      className="mx-auto h-48 w-48 rounded-lg border"
                    />
                  </div>
                ) : aguardandoQr ? (
                  <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/30 px-4">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="text-center text-sm text-muted-foreground">
                      {obterQr.isFetching ? "Sincronizando QR Code..." : "Aguardando QR Code..."}
                    </p>
                    {estadoQr === "connecting" && (
                      <p className="text-center text-xs text-muted-foreground">
                        A sessão está sendo preparada. Atualizamos automaticamente a cada poucos
                        segundos.
                      </p>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={provisionar.isPending || obterQr.isFetching}
                      onClick={() => void handleRegenerarQr()}
                    >
                      Gerar novamente
                    </Button>
                  </div>
                ) : (
                  <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/30">
                    {obterQr.isLoading || provisionar.isPending ? (
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    ) : null}
                    <p className="text-sm text-muted-foreground">
                      {provisionar.isPending ? "Provisionando..." : "Gerando QR Code..."}
                    </p>
                  </div>
                )}
                {pairingCode && (
                  <p className="text-center text-xs">
                    Código de pareamento: <strong>{pairingCode}</strong>
                  </p>
                )}
                <p className="text-center text-muted-foreground">
                  Escaneie o QR Code no WhatsApp → Aparelhos conectados
                </p>
                {qrBase64 && (
                  <p className="text-center text-xs text-muted-foreground">
                    Se o WhatsApp exibir{" "}
                    <span className="italic">
                      &quot;Não foi possível conectar novos dispositivos no momento&quot;
                    </span>{" "}
                    ou{" "}
                    <span className="italic">&quot;Tente novamente mais tarde&quot;</span>, aguarde
                    10 segundos até um novo protocolo ser gerado e escaneie o QR Code novamente.
                  </p>
                )}
                {(obterQr.data?._debug ?? statusConexao.data?._debug) ? (
                  <details className="mt-4 rounded-md border bg-muted/20 p-3 text-xs">
                    <summary className="cursor-pointer font-medium">
                      Debug Evolution (temporário)
                    </summary>
                    <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all">
                      {JSON.stringify(
                        {
                          obterQr: obterQr.data?._debug,
                          statusConexao: statusConexao.data?._debug,
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                ) : null}
              </>
            )}

            {inst.provider === "cloud_api" && (
              <Tabs defaultValue="manual">
                <TabsList className="w-full">
                  <TabsTrigger value="embed" className="flex-1">
                    Embedded Signup
                  </TabsTrigger>
                  <TabsTrigger value="manual" className="flex-1">
                    Manual
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="embed" className="space-y-2 pt-4">
                  <p className="text-muted-foreground">
                    Configure <code>VITE_META_APP_ID</code> e <code>VITE_META_CONFIG_ID</code> no
                    ambiente. O fluxo Embedded Signup da Meta será carregado aqui quando as
                    credenciais estiverem configuradas.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Enquanto isso, use a aba Manual para informar Phone Number ID, WABA ID e token.
                  </p>
                </TabsContent>
                <TabsContent value="manual" className="space-y-3 pt-4">
                  <div className="space-y-2">
                    <Label>Phone Number ID</Label>
                    <Input value={cloudPhone} onChange={(e) => setCloudPhone(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>WABA ID</Label>
                    <Input value={cloudWaba} onChange={(e) => setCloudWaba(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Access Token</Label>
                    <Input
                      type="password"
                      value={cloudToken}
                      onChange={(e) => setCloudToken(e.target.value)}
                    />
                  </div>
                  <Button
                    className="w-full"
                    disabled={configurarCloud.isPending}
                    onClick={handleCloudManual}
                  >
                    Salvar e continuar
                  </Button>
                </TabsContent>
              </Tabs>
            )}

            {conectado && (
              <Button
                className="w-full"
                onClick={() =>
                  navigate({
                    to: "/$organizacaoHash/integracao",
                    params: { organizacaoHash: organizacaoHash! },
                    search: { instance: instanceId, step: "concluido", modo: "" },
                  })
                }
              >
                WhatsApp conectado — continuar
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {wizardStep === "concluido" && (
        <Card>
          <CardContent className="space-y-4 py-8 text-center">
            <Check className="mx-auto h-12 w-12 text-wa-green" />
            <h2 className="text-xl font-semibold">Tudo pronto!</h2>
            <p className="text-sm text-muted-foreground">
              Você tem 3 dias de demonstração gratuita. Redirecionando para o painel...
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function instanciaEvolutionProntaParaQr(
  inst: InstanciaOnboarding | undefined,
  provisionando: boolean,
  provisionado: boolean,
): boolean {
  return Boolean(
    inst &&
      isEvolutionProvider(inst.provider) &&
      !provisionando &&
      (provisionado || inst.status !== "pending_connection"),
  );
}

function useRedirecionarOnboardingConcluido(
  wizardStep: WizardStep,
  instanceId: string,
  organizacaoHash: string | undefined,
  navigate: ReturnType<typeof useNavigate>,
) {
  useEffect(() => {
    if (wizardStep === "concluido" && instanceId && organizacaoHash) {
      const t = setTimeout(
        () => navigate({ to: "/$organizacaoHash", params: { organizacaoHash } }),
        2000,
      );
      return () => clearTimeout(t);
    }
  }, [wizardStep, instanceId, navigate, organizacaoHash]);
}

function useProvisionamentoEvolution({
  instanceId,
  inst,
  provisionar,
}: {
  instanceId: string;
  inst: InstanciaOnboarding | undefined;
  provisionar: UseMutationResult<{ ok: boolean }, Error, { instanciaId: string }, unknown>;
}) {
  const { mutate, isPending, isSuccess, isError } = provisionar;

  useEffect(() => {
    if (
      instanceId &&
      inst &&
      isEvolutionProvider(inst.provider) &&
      (inst.status === "pending_connection" || inst.status === "disconnected") &&
      !isPending &&
      !isSuccess &&
      !isError
    ) {
      mutate({ instanciaId: instanceId });
    }
  }, [instanceId, inst, isPending, isSuccess, isError, mutate]);
}

function subtituloPassoOnboarding(
  passo: WizardStep,
  provedor?: InstanceProvider,
): string {
  switch (passo) {
    case "escolher":
      return "Passo 1 — escolha qual WhatsApp reconectar";
    case "tipo":
      return "Passo 1 de 3 — escolha seu WhatsApp Business ou Cloud";
    case "conexao":
      return provedor
        ? `Passo 2 de 3 — conecte ${rotuloSeuWhatsApp(provedor)}`
        : "Passo 2 de 3 — conecte seu WhatsApp";
    case "concluido":
      return "Passo 3 de 3 — pronto para começar";
  }
}
