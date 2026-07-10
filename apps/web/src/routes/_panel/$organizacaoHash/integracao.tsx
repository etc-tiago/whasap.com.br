/**
 * Wizard de integração: passos explícitos na URL, polling só no passo QR.
 */
import { skipToken, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { isEvolutionProvider, type InstanceProvider } from "@whasap/config";
import { useCallback, useEffect, useState } from "react";

import { IntegracaoStepCloudConfig } from "@/components/integracao/integracao-step-cloud-config";
import { IntegracaoStepCloudSincronia } from "@/components/integracao/integracao-step-cloud-sincronia";
import { IntegracaoStepConcluido } from "@/components/integracao/integracao-step-concluido";
import { IntegracaoStepEscolher } from "@/components/integracao/integracao-step-escolher";
import { IntegracaoStepEvolutionQr } from "@/components/integracao/integracao-step-evolution-qr";
import { IntegracaoStepEvolutionSincronia } from "@/components/integracao/integracao-step-evolution-sincronia";
import { IntegracaoStepTipo } from "@/components/integracao/integracao-step-tipo";
import { IntegracaoWizardShell } from "@/components/integracao/integracao-wizard-shell";
import { instanciasParaReconectar } from "@/lib/instancia-status";
import {
  isIntegracaoStep,
  progressoIntegracao,
  resolverIntegracaoStep,
  subtituloIntegracao,
  type CloudCredenciais,
  type IntegracaoStep,
} from "@/lib/integracao/wizard-state";
import { orgInput } from "@/lib/org-input";
import { orpc } from "@/lib/orpc";
import { useOrganizacaoHash } from "@/lib/use-organizacao-hash";

export const Route = createFileRoute("/_panel/$organizacaoHash/integracao")({
  validateSearch: (s: Record<string, unknown>) => {
    const stepRaw = (s.step as string) ?? "";
    return {
      instance: (s.instance as string) ?? "",
      step: isIntegracaoStep(stepRaw) ? stepRaw : "",
      modo: (s.modo as string) === "novo" ? "novo" : "",
    };
  },
  component: IntegracaoPage,
});

function IntegracaoPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const organizacaoHash = useOrganizacaoHash();
  const { instance: instanceId, step: searchStep, modo } = Route.useSearch();
  const modoNovo = modo === "novo";

  const NOME_INSTANCIA_PADRAO = "Atendimento";
  const [cloudPhone, setCloudPhone] = useState("");
  const [cloudWaba, setCloudWaba] = useState("");
  const [cloudToken, setCloudToken] = useState("");
  const [cloudCredenciais, setCloudCredenciais] = useState<CloudCredenciais | null>(null);

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

  const invalidarLista = useCallback(() => {
    if (!organizacaoHash) return;
    void queryClient.invalidateQueries({
      queryKey: orpc.instancia.lista.key({ input: { organizacaoHash } }),
    });
  }, [queryClient, organizacaoHash]);

  const criar = useMutation(
    orpc.instancia.criar.mutationOptions({
      onSuccess: invalidarLista,
    }),
  );

  const inst = instance.data;
  const listaReconectar = instanciasParaReconectar(instancias.data ?? []);

  const wizardStep: IntegracaoStep = resolverIntegracaoStep({
    searchStep,
    instanceId,
    modoNovo,
    temInstanciasParaReconectar: listaReconectar.length > 0,
    instancia: inst,
  });

  const progress = progressoIntegracao(wizardStep);

  useEffect(() => {
    if (wizardStep === "cloud_sincronia" && instanceId && !cloudCredenciais && organizacaoHash) {
      navigate({
        to: "/$organizacaoHash/integracao",
        params: { organizacaoHash },
        search: { instance: instanceId, step: "cloud_config", modo: "" },
      });
    }
  }, [wizardStep, instanceId, cloudCredenciais, organizacaoHash, navigate]);

  const irPara = useCallback(
    (params: { instance?: string; step: IntegracaoStep; modo?: string }) => {
      if (!organizacaoHash) return;
      navigate({
        to: "/$organizacaoHash/integracao",
        params: { organizacaoHash },
        search: {
          instance: params.instance ?? "",
          step: params.step,
          modo: params.modo ?? "",
        },
      });
    },
    [navigate, organizacaoHash],
  );

  const irParaTipo = useCallback(() => {
    setCloudCredenciais(null);
    invalidarLista();
    irPara({ step: "tipo", instance: "", modo: "" });
  }, [irPara, invalidarLista]);

  async function handleSelecionarTipo(provider: InstanceProvider) {
    if (!organizacaoHash || criar.isPending) return;
    const created = await criar.mutateAsync({
      organizacaoHash,
      nome: NOME_INSTANCIA_PADRAO,
      provider,
    });
    const step: IntegracaoStep =
      provider === "evolution" ? "evolution_qr" : "cloud_config";
    irPara({ instance: created.id, step });
  }

  function handleSelecionarInstancia(id: string, itemProvider: string) {
    const step: IntegracaoStep = isEvolutionProvider(itemProvider)
      ? "evolution_qr"
      : "cloud_config";
    irPara({ instance: id, step });
  }

  function handleCloudContinuar(credenciais: CloudCredenciais) {
    setCloudCredenciais(credenciais);
    irPara({ instance: instanceId, step: "cloud_sincronia" });
  }

  return (
    <div className="relative mx-auto max-w-lg p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Configurar</h1>
        <p className="text-sm text-muted-foreground">
          {subtituloIntegracao(wizardStep, inst?.provider as InstanceProvider | undefined)}
        </p>
      </div>

      <IntegracaoWizardShell step={wizardStep} progress={progress}>
        {wizardStep === "escolher" && (
          <IntegracaoStepEscolher
            instancias={listaReconectar}
            onSelecionar={handleSelecionarInstancia}
            onNova={() => irPara({ step: "tipo", modo: "novo" })}
          />
        )}

        {wizardStep === "tipo" && (
          <IntegracaoStepTipo
            instanceId={instanceId}
            criando={criar.isPending}
            temReconectar={listaReconectar.length > 0}
            onSelecionarProvider={(p) => void handleSelecionarTipo(p)}
            onVoltarReconectar={() => irPara({ step: "escolher" })}
            onTrocarTipo={irParaTipo}
          />
        )}

        {wizardStep === "evolution_qr" && instanceId && inst && (
          <IntegracaoStepEvolutionQr
            instanciaId={instanceId}
            instanciaNome={inst.nome}
            provider={inst.provider}
            onConectado={() => irPara({ instance: instanceId, step: "evolution_sincronia" })}
            onTrocarTipo={irParaTipo}
          />
        )}

        {wizardStep === "evolution_sincronia" && (
          <IntegracaoStepEvolutionSincronia
            onConcluir={() => irPara({ instance: instanceId, step: "concluido" })}
          />
        )}

        {wizardStep === "cloud_config" && instanceId && inst && (
          <IntegracaoStepCloudConfig
            instanciaId={instanceId}
            instanciaNome={inst.nome}
            provider={inst.provider}
            phone={cloudPhone}
            waba={cloudWaba}
            token={cloudToken}
            onPhoneChange={setCloudPhone}
            onWabaChange={setCloudWaba}
            onTokenChange={setCloudToken}
            onContinuar={handleCloudContinuar}
            onTrocarTipo={irParaTipo}
          />
        )}

        {wizardStep === "cloud_sincronia" && instanceId && cloudCredenciais && (
          <IntegracaoStepCloudSincronia
            instanciaId={instanceId}
            credenciais={cloudCredenciais}
            onSucesso={() => {
              invalidarLista();
              irPara({ instance: instanceId, step: "concluido" });
            }}
            onVoltarConfig={() => irPara({ instance: instanceId, step: "cloud_config" })}
          />
        )}

        {wizardStep === "concluido" && organizacaoHash && (
          <IntegracaoStepConcluido
            onRedirecionar={() => navigate({ to: "/$organizacaoHash", params: { organizacaoHash } })}
          />
        )}
      </IntegracaoWizardShell>
    </div>
  );
}
