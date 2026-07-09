import { Button } from "@whasap/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@whasap/ui/components/card";
import { Input } from "@whasap/ui/components/input";
import { Label } from "@whasap/ui/components/label";
import { Smartphone } from "lucide-react";

import { rotuloWhatsApp, type InstanceProvider } from "@whasap/config";

import { TrocarTipoButton } from "./trocar-tipo-button";

type Props = {
  provider: InstanceProvider;
  nome: string;
  instanceId: string;
  criando: boolean;
  temReconectar: boolean;
  onProviderChange: (p: InstanceProvider) => void;
  onNomeChange: (nome: string) => void;
  onContinuar: () => void;
  onVoltarReconectar: () => void;
  onTrocarTipo: () => void;
};

export function IntegracaoStepTipo({
  provider,
  nome,
  instanceId,
  criando,
  temReconectar,
  onProviderChange,
  onNomeChange,
  onContinuar,
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
            onClick={() => onProviderChange("evolution")}
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
            onClick={() => onProviderChange("cloud_api")}
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
            onChange={(e) => onNomeChange(e.target.value)}
            placeholder="Atendimento"
          />
        </div>
        <Button className="w-full" disabled={!nome.trim() || criando} onClick={onContinuar}>
          Continuar
        </Button>
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
