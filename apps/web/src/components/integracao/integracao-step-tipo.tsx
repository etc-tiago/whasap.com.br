import {
  ICONE_CONEXAO_PADRAO,
  rotuloProvedor,
  type IconeConexao,
  type InstanceProvider,
} from "@whasap/config";
import { Button } from "@whasap/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@whasap/ui/components/card";
import { Smartphone } from "lucide-react";
import { useState } from "react";

import { ConexaoIdentidadeFields } from "@/components/conexao-identidade-fields";

import { TrocarTipoButton } from "./trocar-tipo-button";

type Props = {
  instanceId: string;
  criando: boolean;
  temReconectar: boolean;
  onSelecionarProvider: (
    p: InstanceProvider,
    identidade: { nome: string; icone: IconeConexao },
  ) => void;
  onVoltarReconectar: () => void;
  onTrocarTipo: () => void;
};

export function IntegracaoStepTipo({
  instanceId,
  criando,
  temReconectar,
  onSelecionarProvider,
  onVoltarReconectar,
  onTrocarTipo,
}: Props) {
  const [nome, setNome] = useState("Atendimento");
  const [icone, setIcone] = useState<IconeConexao>(ICONE_CONEXAO_PADRAO);
  const nomeOk = nome.trim().length >= 2;

  function selecionar(provider: InstanceProvider) {
    if (!nomeOk || criando) return;
    onSelecionarProvider(provider, { nome: nome.trim(), icone });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nova conexão</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <ConexaoIdentidadeFields
          nome={nome}
          icone={icone}
          onNomeChange={setNome}
          onIconeChange={setIcone}
          disabled={criando}
        />
        <div>
          <p className="mb-3 text-sm font-medium">Tipo de conexão</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={criando || !nomeOk}
              onClick={() => selecionar("evo")}
              className="rounded-lg border border-border p-4 text-left transition hover:border-wa-green hover:bg-wa-green/5 disabled:opacity-50"
            >
              <Smartphone className="mb-2 h-5 w-5" />
              <p className="font-medium">{rotuloProvedor("evo")}</p>
              <p className="text-xs text-muted-foreground">Conexão via QR Code</p>
            </button>
            <button
              type="button"
              disabled={criando || !nomeOk}
              onClick={() => selecionar("meta_cloud")}
              className="rounded-lg border border-border p-4 text-left transition hover:border-wa-green hover:bg-wa-green/5 disabled:opacity-50"
            >
              <Smartphone className="mb-2 h-5 w-5" />
              <p className="font-medium">{rotuloProvedor("meta_cloud")}</p>
              <p className="text-xs text-muted-foreground">API oficial da Meta</p>
            </button>
          </div>
        </div>
        {instanceId ? <TrocarTipoButton instanciaId={instanceId} onSucesso={onTrocarTipo} /> : null}
        {temReconectar ? (
          <Button variant="ghost" className="w-full" onClick={onVoltarReconectar}>
            Voltar para reconexão
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
