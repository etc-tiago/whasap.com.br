import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { skipToken, useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@whasap/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@whasap/ui/components/card";
import { Input } from "@whasap/ui/components/input";
import { Label } from "@whasap/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@whasap/ui/components/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@whasap/ui/components/tabs";
import { Check, Gift, Smartphone } from "lucide-react";

import { useSession } from "@/lib/auth";
import { orpc } from "@/lib/orpc";

export const Route = createFileRoute("/_panel/onboarding")({
  validateSearch: (s: Record<string, unknown>) => ({
    instance: (s.instance as string) ?? "",
    step: (s.step as string) ?? "",
  }),
  component: OnboardingPage,
});

type WizardStep = "tipo" | "conexao" | "trial" | "pagamento" | "concluido";

function OnboardingPage() {
  const navigate = useNavigate();
  const { instance: instanceId, step: searchStep } = Route.useSearch();
  const { data: session } = useSession();

  const [nome, setNome] = useState("");
  const [provider, setProvider] = useState<"evolution" | "cloud_api">("evolution");
  const [documento, setDocumento] = useState("");
  const [tipoDocumento, setTipoDocumento] = useState<"cpf" | "cnpj">("cnpj");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [cloudPhone, setCloudPhone] = useState("");
  const [cloudWaba, setCloudWaba] = useState("");
  const [cloudToken, setCloudToken] = useState("");
  const [activeInstanceId, setActiveInstanceId] = useState(instanceId);

  const orgId = session?.organizacao?.id;

  const instance = useQuery(
    orpc.instancia.obter.queryOptions({
      input: activeInstanceId ? { instanciaId: activeInstanceId } : skipToken,
    }),
  );

  const criar = useMutation(orpc.instancia.criar.mutationOptions());
  const provisionar = useMutation(orpc.instancia.provisionar.mutationOptions());
  const obterQr = useQuery(
    orpc.instancia.obterQr.queryOptions({
      input: activeInstanceId ? { instanciaId: activeInstanceId } : skipToken,
      enabled: Boolean(activeInstanceId && instance.data?.provider === "evolution"),
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
  const checkout = useMutation(orpc.instancia.criarCheckout.mutationOptions());

  const inst = instance.data;
  const conectado = statusConexao.data?.conectado ?? false;

  const wizardStep: WizardStep = (() => {
    if (searchStep === "concluido" || inst?.status === "connected") return "concluido";
    if (!activeInstanceId) return "tipo";
    if (inst?.status === "pending_payment") {
      if (searchStep === "pagamento") return "pagamento";
      return "trial";
    }
    return "conexao";
  })();

  useEffect(() => {
    if (wizardStep === "concluido" && activeInstanceId) {
      const t = setTimeout(() => navigate({ to: "/" }), 2000);
      return () => clearTimeout(t);
    }
  }, [wizardStep, activeInstanceId, navigate]);

  useEffect(() => {
    if (
      activeInstanceId &&
      inst?.provider === "evolution" &&
      inst.status === "pending_connection" &&
      !provisionar.isPending &&
      !provisionar.isSuccess
    ) {
      provisionar.mutate({ instanciaId: activeInstanceId });
    }
  }, [activeInstanceId, inst?.provider, inst?.status, provisionar.isPending, provisionar.isSuccess]);

  async function handleCriarInstancia() {
    if (!orgId || !nome.trim()) return;
    const created = await criar.mutateAsync({
      organizacaoId: orgId,
      nome,
      provider,
    });
    setActiveInstanceId(created.id);
    navigate({ to: "/onboarding", search: { instance: created.id, step: "" } });
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
  }

  async function handleCheckout() {
    if (!activeInstanceId) return;
    const { urlCheckout } = await checkout.mutateAsync({
      instanciaId: activeInstanceId,
      documento,
      tipoDocumento,
      razaoSocial,
    });
    window.location.href = urlCheckout;
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Configurar Whasap</h1>
        <p className="text-sm text-muted-foreground">
          Passo {stepNumber(wizardStep)} de 5 — configure sua instância WhatsApp
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
                className={`rounded-lg border p-4 text-left transition ${
                  provider === "evolution" ? "border-wa-green bg-wa-green/5" : "border-border"
                }`}
              >
                <Smartphone className="mb-2 h-5 w-5" />
                <p className="font-medium">WhatsApp Business</p>
                <p className="text-xs text-muted-foreground">Conexão via QR Code (Evolution)</p>
              </button>
              <button
                type="button"
                onClick={() => setProvider("cloud_api")}
                className={`rounded-lg border p-4 text-left transition ${
                  provider === "cloud_api" ? "border-wa-green bg-wa-green/5" : "border-border"
                }`}
              >
                <Smartphone className="mb-2 h-5 w-5" />
                <p className="font-medium">WhatsApp Cloud API</p>
                <p className="text-xs text-muted-foreground">Meta Embedded ou manual</p>
              </button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nome">Nome da instância</Label>
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
              Instância: <strong>{inst.nome}</strong> ({inst.provider === "evolution" ? "Business" : "Cloud API"})
            </p>

            {inst.provider === "evolution" && (
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
                    to: "/onboarding",
                    search: { instance: activeInstanceId, step: "" },
                  })
                }
              >
                WhatsApp conectado — continuar
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {wizardStep === "trial" && inst && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-wa-green" />
              Comece com 3 dias grátis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-wa-green" />
                3 dias gratuitos para testar tudo
              </li>
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-wa-green" />
                Cancele quando quiser, sem multa
              </li>
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-wa-green" />
                R$ 99/mês após o trial — inclui 1.000 conversas
              </li>
            </ul>
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <p>
                <strong>{inst.nome}</strong>
              </p>
              <p className="text-muted-foreground">
                {inst.provider === "evolution" ? "WhatsApp Business" : "WhatsApp Cloud API"}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Cadastre PIX ou cartão de crédito para iniciar o trial. A primeira cobrança ocorre
              após 3 dias se você não cancelar. Com PIX, cada mês você receberá uma fatura para
              pagamento.
            </p>
            <Button
              className="w-full"
              onClick={() =>
                navigate({
                  to: "/onboarding",
                  search: { instance: activeInstanceId, step: "pagamento" },
                })
              }
            >
              Continuar para cadastrar pagamento
            </Button>
          </CardContent>
        </Card>
      )}

      {wizardStep === "pagamento" && inst && (
        <Card>
          <CardHeader>
            <CardTitle>Dados de faturamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de documento</Label>
              <Select
                value={tipoDocumento}
                onValueChange={(v) => setTipoDocumento(v as "cpf" | "cnpj")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cnpj">CNPJ</SelectItem>
                  <SelectItem value="cpf">CPF</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Documento</Label>
              <Input value={documento} onChange={(e) => setDocumento(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Razão social / Nome</Label>
              <Input value={razaoSocial} onChange={(e) => setRazaoSocial(e.target.value)} />
            </div>
            <Button
              className="w-full"
              disabled={checkout.isPending || !documento || !razaoSocial}
              onClick={handleCheckout}
            >
              Ir para pagamento seguro (PIX ou cartão)
            </Button>
          </CardContent>
        </Card>
      )}

      {wizardStep === "concluido" && (
        <Card>
          <CardContent className="space-y-4 py-8 text-center">
            <Check className="mx-auto h-12 w-12 text-wa-green" />
            <h2 className="text-xl font-semibold">Tudo pronto!</h2>
            <p className="text-sm text-muted-foreground">
              Sua instância está ativa. Redirecionando para o painel...
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function stepNumber(step: WizardStep): number {
  const map: Record<WizardStep, number> = {
    tipo: 1,
    conexao: 2,
    trial: 3,
    pagamento: 4,
    concluido: 5,
  };
  return map[step];
}
