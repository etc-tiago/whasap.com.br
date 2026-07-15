import { Button } from "@whasap/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@whasap/ui/components/card";
import { Input } from "@whasap/ui/components/input";
import { Label } from "@whasap/ui/components/label";

import { rotuloSeuWhatsApp, type InstanceProvider } from "@whasap/config";

import type { CloudCredenciais } from "@/lib/integracao/wizard-state";

import { TrocarTipoButton } from "./trocar-tipo-button";

type Props = {
  instanciaId: string;
  instanciaNome: string;
  provider: string;
  phone: string;
  waba: string;
  token: string;
  onPhoneChange: (v: string) => void;
  onWabaChange: (v: string) => void;
  onTokenChange: (v: string) => void;
  onContinuar: (credenciais: CloudCredenciais) => void;
  onTrocarTipo: () => void;
};

export function IntegracaoStepCloudConfig({
  instanciaId,
  instanciaNome,
  provider,
  phone,
  waba,
  token,
  onPhoneChange,
  onWabaChange,
  onTokenChange,
  onContinuar,
  onTrocarTipo,
}: Props) {
  const podeContinuar = phone.trim() && waba.trim() && token.trim();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configurar WhatsApp Cloud API</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-muted-foreground">
          <strong>{instanciaNome}</strong> — {rotuloSeuWhatsApp(provider as InstanceProvider)}
        </p>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Phone Number ID</Label>
            <Input value={phone} onChange={(e) => onPhoneChange(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>WABA ID</Label>
            <Input value={waba} onChange={(e) => onWabaChange(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Access Token</Label>
            <Input type="password" value={token} onChange={(e) => onTokenChange(e.target.value)} />
          </div>
          <Button
            className="w-full"
            disabled={!podeContinuar}
            onClick={() =>
              onContinuar({
                phoneNumberId: phone.trim(),
                wabaId: waba.trim(),
                accessToken: token.trim(),
              })
            }
          >
            Continuar
          </Button>
        </div>
        <TrocarTipoButton instanciaId={instanciaId} onSucesso={onTrocarTipo} variant="outline" />
      </CardContent>
    </Card>
  );
}
