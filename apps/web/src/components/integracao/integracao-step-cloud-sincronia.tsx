import { useMutation } from "@tanstack/react-query";
import { Button } from "@whasap/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@whasap/ui/components/card";
import { Check, Loader2, X } from "lucide-react";
import { useEffect, useRef } from "react";

import { getOrpcErrorMessage } from "@/lib/orpc-error";
import { useAguardarMinimo } from "@/lib/integracao/use-aguardar-minimo";
import type { CloudCredenciais } from "@/lib/integracao/wizard-state";
import { orpc } from "@/lib/orpc";

const SINCRONIA_MS = 5000;

type Props = {
  instanciaId: string;
  credenciais: CloudCredenciais;
  onSucesso: (templatesCount: number) => void;
  onVoltarConfig: () => void;
};

export function IntegracaoStepCloudSincronia({
  instanciaId,
  credenciais,
  onSucesso,
  onVoltarConfig,
}: Props) {
  const iniciadoRef = useRef(false);

  const configurar = useMutation(orpc.instancia.configurarCloud.mutationOptions({ retry: false }));

  useEffect(() => {
    if (iniciadoRef.current) return;
    iniciadoRef.current = true;

    void configurar.mutateAsync({
      instanciaId,
      phoneNumberId: credenciais.phoneNumberId,
      wabaId: credenciais.wabaId,
      accessToken: credenciais.accessToken,
    }).catch(() => {
      // erro exibido via configurar.isError
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dispara uma vez por montagem
  }, [instanciaId]);

  const aguardandoMinimo = useAguardarMinimo(SINCRONIA_MS);

  useEffect(() => {
    if (!configurar.isSuccess || !aguardandoMinimo) return;
    const t = setTimeout(
      () => onSucesso(configurar.data?.templatesCount ?? 0),
      1500,
    );
    return () => clearTimeout(t);
  }, [configurar.isSuccess, configurar.data, aguardandoMinimo, onSucesso]);

  const concluido = configurar.isSuccess && aguardandoMinimo;
  const falhou = configurar.isError && aguardandoMinimo;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sincronizando modelos</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4 py-12">
        {!concluido && !falhou ? (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-wa-green" />
            <p className="text-center text-sm text-muted-foreground">
              Validando credenciais e sincronizando modelos de mensagem com a Meta...
            </p>
          </>
        ) : concluido ? (
          <>
            <Check className="h-10 w-10 text-wa-green" />
            <p className="text-center text-sm text-muted-foreground">
              {configurar.data?.templatesCount ?? 0} modelos sincronizados com sucesso.
            </p>
          </>
        ) : (
          <>
            <X className="h-10 w-10 text-destructive" />
            <p className="text-center text-sm text-destructive">
              {getOrpcErrorMessage(
                configurar.error,
                "Não foi possível sincronizar os modelos. Verifique as credenciais.",
              )}
            </p>
            <Button variant="outline" onClick={onVoltarConfig}>
              Voltar e corrigir credenciais
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
