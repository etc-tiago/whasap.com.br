import { useQuery } from "@tanstack/react-query";
import { Button } from "@whasap/ui/components/button";
import { Input } from "@whasap/ui/components/input";
import { Label } from "@whasap/ui/components/label";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { getOrpcErrorMessage } from "@/lib/orpc-error";
import { orpc } from "@/lib/orpc";

type Props = {
  /** UUID da conexão — usado como Verify token no Meta. */
  instanciaId: string;
  /** Título curto acima do bloco (opcional). */
  titulo?: string;
  className?: string;
};

/** Exibe Callback URL, Verify token (UUID da conexão) e campos do webhook Cloud API. */
export function WebhookCloudApiConfig({
  instanciaId,
  titulo = "Webhook no Meta for Developers",
  className,
}: Props) {
  const config = useQuery(orpc.instancia.webhookCloud.queryOptions({ input: { instanciaId } }));
  const [copiado, setCopiado] = useState<string | null>(null);

  const copiar = async (rotulo: string, valor: string) => {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(rotulo);
      toast.success(`${rotulo} copiado`);
      window.setTimeout(() => setCopiado(null), 2000);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <div className={className}>
      <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4">
        <div>
          <p className="text-sm font-medium">{titulo}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Em WhatsApp → Configuration → Webhook, use estes valores. O Verify token é o ID desta
            conexão.
          </p>
        </div>

        {config.isLoading ? (
          <p className="text-xs text-muted-foreground">Carregando configuração…</p>
        ) : config.isError ? (
          <p className="text-xs text-destructive">
            {getOrpcErrorMessage(config.error, "Não foi possível carregar o webhook.")}
          </p>
        ) : config.data ? (
          <div className="space-y-3">
            <CampoCopiavel
              label="Callback URL"
              value={config.data.callbackUrl}
              copiado={copiado === "Callback URL"}
              onCopiar={() => void copiar("Callback URL", config.data.callbackUrl)}
            />
            <CampoCopiavel
              label="Verify token"
              value={config.data.verifyToken}
              copiado={copiado === "Verify token"}
              onCopiar={() => void copiar("Verify token", config.data.verifyToken)}
            />
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Webhook fields</Label>
              <p className="font-mono text-xs text-foreground">{config.data.campos.join(", ")}</p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CampoCopiavel({
  label,
  value,
  copiado,
  onCopiar,
}: {
  label: string;
  value: string;
  copiado: boolean;
  onCopiar: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex gap-2">
        <Input readOnly value={value} className="font-mono text-xs" />
        <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={onCopiar}>
          {copiado ? <Check className="h-4 w-4 text-wa-green" /> : <Copy className="h-4 w-4" />}
          <span className="sr-only">Copiar {label}</span>
        </Button>
      </div>
    </div>
  );
}
