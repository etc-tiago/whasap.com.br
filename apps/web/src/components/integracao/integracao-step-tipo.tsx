import { Button } from "@whasap/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@whasap/ui/components/card";
import { Smartphone } from "lucide-react";

import { rotuloWhatsApp, type InstanceProvider } from "@whasap/config";

import { TrocarTipoButton } from "./trocar-tipo-button";

type Props = {
  instanceId: string;
  criando: boolean;
  temReconectar: boolean;
  onSelecionarProvider: (p: InstanceProvider) => void;
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
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tipo de conexão</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={criando}
            onClick={() => onSelecionarProvider("evolution")}
            className="rounded-lg border border-border p-4 text-left transition hover:border-wa-green hover:bg-wa-green/5 disabled:opacity-50"
          >
            <Smartphone className="mb-2 h-5 w-5" />
            <p className="font-medium">{rotuloWhatsApp("evolution")}</p>
            <p className="text-xs text-muted-foreground">Conexão via QR Code</p>
          </button>
          <button
            type="button"
            disabled={criando}
            onClick={() => onSelecionarProvider("cloud_api")}
            className="rounded-lg border border-border p-4 text-left transition hover:border-wa-green hover:bg-wa-green/5 disabled:opacity-50"
          >
            <Smartphone className="mb-2 h-5 w-5" />
            <p className="font-medium">{rotuloWhatsApp("cloud_api")}</p>
            <p className="text-xs text-muted-foreground">API oficial da Meta</p>
          </button>
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
