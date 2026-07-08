/**
 * Wizard de onboarding: escolha de provider e conexão WhatsApp.
 * Auto-provisiona instâncias Evolution em `pending_connection` via `useEffect`.
 */
import { skipToken, useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@whasap/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@whasap/ui/components/card";
import { Input } from "@whasap/ui/components/input";
import { Label } from "@whasap/ui/components/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@whasap/ui/components/tabs";
import { Check, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";

import { derivarPassoOnboarding, type PassoOnboarding } from "@/lib/onboarding";
import { orpc } from "@/lib/orpc";
import { useOrganizacaoHash } from "@/lib/use-organizacao-hash";
import { isEvolutionProvider, rotuloSeuWhatsApp, rotuloWhatsApp, type InstanceProvider } from "@whasap/config";

export const Route = createFileRoute("/_panel/$organizacaoHash/integracao")({
  validateSearch: (s: Record<string, unknown>) => ({
    instance: (s.instance as string) ?? "",
    step: (s.step as string) ?? "",
  }),
  component: OnboardingPage,
});

type WizardStep = PassoOnboarding;

function OnboardingPage() {
  const navigate = useNavigate();
  const { instance: instanceId, step: searchStep } = Route.useSearch();
  const organizacaoHash = useOrganizacaoHash();
  const [provider, setProvider] = useState<InstanceProvider>("evolution");
  const [cloudPhone, setCloudPhone] = useState("");
  const [cloudWaba, setCloudWaba] = useState("");
  const [cloudToken, setCloudToken] = useState("");
  const [activeInstanceId, setActiveInstanceId] = useState(instanceId);
  const [nome, setNome] = useState("");

  const instance = useQuery(
    orpc.instancia.obter.queryOptions({
      input: activeInstanceId ? { instanciaId: activeInstanceId } : skipToken,
    }),
  );

  const criar = useMutation(orpc.instancia.criar.mutationOptions());
  const provisionar = useMutation(orpc.instancia.provisionar.mutationOptions());
  const {
    mutate: provisionarInstancia,
    isPending: provisionando,
    isSuccess: provisionado,
  } = provisionar;
  const obterQr = useQuery(
    orpc.instancia.obterQr.queryOptions({
      input: activeInstanceId ? { instanciaId: activeInstanceId } : skipToken,
      enabled: Boolean(
        activeInstanceId && instance.data && isEvolutionProvider(instance.data.provider),
      ),
      refetchInterval: 5000,
    }),
  );
  const statusConexao = useQuery(
    orpc.instancia.statusConexao.queryOptions({
      input: activeInstanceId ? { instanciaId: activeInstanceId } : skipToken,
      enabled: Boolean(activeInstanceId),
      refetchInterval: 3000,
    }),
  );
  const configurarCloud = useMutation(orpc.instancia.configurarCloud.mutationOptions());

  const inst = instance.data;
  const conectado = statusConexao.data?.conectado ?? false;

  const wizardStep: WizardStep = derivarPassoOnboarding({
    searchStep,
    activeInstanceId,
    instancia: inst,
  });

  useEffect(() => {
    if (wizardStep === "concluido" && activeInstanceId && organizacaoHash) {
      const t = setTimeout(
        () => navigate({ to: "/$organizacaoHash", params: { organizacaoHash } }),
        2000,
      );
      return () => clearTimeout(t);
    }
  }, [wizardStep, activeInstanceId, navigate, organizacaoHash]);

  useEffect(() => {
    if (
      activeInstanceId &&
      inst &&
      isEvolutionProvider(inst.provider) &&
      inst.status === "pending_connection" &&
      !provisionando &&
      !provisionado
    ) {
      provisionarInstancia({ instanciaId: activeInstanceId });
    }
  }, [activeInstanceId, inst, provisionando, provisionado, provisionarInstancia]);

  async function handleCriarInstancia() {
    if (!organizacaoHash || !nome.trim()) return;
    const created = await criar.mutateAsync({
      organizacaoHash,
      nome,
      provider,
    });
    setActiveInstanceId(created.id);
    navigate({
      to: "/$organizacaoHash/integracao",
      params: { organizacaoHash },
      search: { instance: created.id, step: "" },
    });
  }

  async function handleCloudManual() {
    if (!activeInstanceId) return;
    await configurarCloud.mutateAsync({
      instanciaId: activeInstanceId,
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
                  className={`rounded-lg border p-4 text-left transition ${provider === "evolution" ? "border-wa-green bg-wa-green/5" : "border-border"
                    }`}
                >
                  <Smartphone className="mb-2 h-5 w-5" />
                  <p className="font-medium">{rotuloWhatsApp("evolution")}</p>
                  <p className="text-xs text-muted-foreground">Conexão via QR Code</p>
                </button>
                <button
                  type="button"
                  onClick={() => setProvider("cloud_api")}
                  className={`rounded-lg border p-4 text-left transition ${provider === "cloud_api" ? "border-wa-green bg-wa-green/5" : "border-border"
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
                  {obterQr.data?.base64 ? (
                    <img
                      src={
                        obterQr.data.base64.startsWith("data:")
                          ? obterQr.data.base64
                          : `data:image/png;base64,${obterQr.data.base64}`
                      }
                      alt="QR Code WhatsApp"
                      className="mx-auto h-48 w-48 rounded-lg border"
                    />
                  ) : (
                    <div className="flex h-48 items-center justify-center rounded-lg border border-dashed bg-muted/30">
                      {provisionar.isPending ? "Provisionando..." : "Gerando QR Code..."}
                    </div>
                  )}
                  {obterQr.data?.pairingCode && (
                    <p className="text-center text-xs">
                      Código de pareamento: <strong>{obterQr.data.pairingCode}</strong>
                    </p>
                  )}
                  <p className="text-center text-muted-foreground">
                    Escaneie o QR Code no WhatsApp → Aparelhos conectados
                  </p>
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
                      search: { instance: activeInstanceId, step: "concluido" },
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

function subtituloPassoOnboarding(
  passo: WizardStep,
  provedor?: InstanceProvider,
): string {
  switch (passo) {
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
