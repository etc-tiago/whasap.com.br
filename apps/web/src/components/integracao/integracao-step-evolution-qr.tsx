import { skipToken, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@whasap/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@whasap/ui/components/card";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";

import { rotuloSeuWhatsApp, type InstanceProvider } from "@whasap/config";

import { getOrpcErrorMessage } from "@/lib/orpc-error";
import { orpc, orpcClient } from "@/lib/orpc";

import { TrocarTipoButton } from "./trocar-tipo-button";

const POLLS_CLOSE_RECONNECT = 5;

type Props = {
  instanciaId: string;
  instanciaNome: string;
  provider: string;
  onConectado: () => void;
  onTrocarTipo: () => void;
};

export function IntegracaoStepEvolutionQr({
  instanciaId,
  instanciaNome,
  provider,
  onConectado,
  onTrocarTipo,
}: Props) {
  const queryClient = useQueryClient();
  const provisionadoParaIdRef = useRef<string | null>(null);
  const navegouRef = useRef(false);
  const pollsCloseRef = useRef(0);
  const reconectouAutoRef = useRef(false);

  const provisionar = useMutation(
    orpc.instancia.provisionar.mutationOptions({
      retry: false,
      onSuccess: () => {
        pollsCloseRef.current = 0;
        reconectouAutoRef.current = false;
        void queryClient.invalidateQueries({
          queryKey: orpc.instancia.obterQr.key({ input: { instanciaId } }),
        });
      },
    }),
  );

  const reiniciarPareamento = useMutation({
    mutationFn: async () => {
      await orpcClient.instancia.encerrarPareamento({ instanciaId });
      await orpcClient.instancia.provisionar({ instanciaId });
    },
    onSuccess: () => {
      pollsCloseRef.current = 0;
      reconectouAutoRef.current = false;
      void queryClient.invalidateQueries({
        queryKey: orpc.instancia.obterQr.key({ input: { instanciaId } }),
      });
    },
  });

  useEffect(() => {
    if (provisionadoParaIdRef.current === instanciaId) return;
    provisionadoParaIdRef.current = instanciaId;
    navegouRef.current = false;
    pollsCloseRef.current = 0;
    reconectouAutoRef.current = false;
    provisionar.mutate({ instanciaId });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dispara uma vez por instanciaId
  }, [instanciaId]);

  const podePoll = provisionar.isSuccess && !provisionar.isError && !reiniciarPareamento.isPending;

  const obterQr = useQuery(
    orpc.instancia.obterQr.queryOptions({
      input: instanciaId ? { instanciaId } : skipToken,
      enabled: podePoll,
      retry: false,
      refetchInterval: (query) => {
        if (query.state.error) return false;
        if (query.state.data?.base64) return false;
        if (query.state.data?.estado === "open") return false;
        return 3000;
      },
    }),
  );

  const conectado = obterQr.data?.estado === "open";
  const qrBase64 = obterQr.data?.base64 ?? null;
  const pairingCode = obterQr.data?.pairingCode ?? null;
  const estadoQr = obterQr.data?.estado ?? null;

  const tentarReiniciarPareamento = useCallback(() => {
    if (reiniciarPareamento.isPending || provisionar.isPending) return;
    reiniciarPareamento.mutate();
  }, [reiniciarPareamento, provisionar.isPending]);

  useEffect(() => {
    if (!conectado || navegouRef.current) return;
    navegouRef.current = true;
    onConectado();
  }, [conectado, onConectado]);

  useEffect(() => {
    if (!podePoll || qrBase64 || obterQr.isFetching) return;
    if (estadoQr !== "close") {
      pollsCloseRef.current = 0;
      return;
    }
    pollsCloseRef.current += 1;
    if (
      pollsCloseRef.current >= POLLS_CLOSE_RECONNECT &&
      !reconectouAutoRef.current &&
      !reiniciarPareamento.isPending
    ) {
      reconectouAutoRef.current = true;
      tentarReiniciarPareamento();
    }
  }, [
    podePoll,
    qrBase64,
    estadoQr,
    obterQr.isFetching,
    reiniciarPareamento.isPending,
    tentarReiniciarPareamento,
  ]);

  const aguardandoQr =
    podePoll &&
    !qrBase64 &&
    !obterQr.isError &&
    !provisionar.isError &&
    !reiniciarPareamento.isError &&
    Boolean(obterQr.data || obterQr.isFetching || reiniciarPareamento.isPending);

  const sessaoFechada = estadoQr === "close" && !qrBase64 && podePoll;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conectar WhatsApp</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-muted-foreground">
          <strong>{instanciaNome}</strong> — {rotuloSeuWhatsApp(provider as InstanceProvider)}
        </p>

        {provisionar.isError ? (
          <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-destructive/30 bg-destructive/5 px-4">
            <p className="text-center text-sm text-destructive">
              {getOrpcErrorMessage(provisionar.error, "Não foi possível provisionar a instância.")}
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={provisionar.isPending}
              onClick={() => provisionar.mutate({ instanciaId })}
            >
              Tentar novamente
            </Button>
          </div>
        ) : reiniciarPareamento.isError ? (
          <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-destructive/30 bg-destructive/5 px-4">
            <p className="text-center text-sm text-destructive">
              {getOrpcErrorMessage(
                reiniciarPareamento.error,
                "Não foi possível reiniciar o pareamento.",
              )}
            </p>
            <Button variant="outline" size="sm" onClick={tentarReiniciarPareamento}>
              Tentar novamente
            </Button>
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
              src={qrBase64.startsWith("data:") ? qrBase64 : `data:image/png;base64,${qrBase64}`}
              alt="QR Code WhatsApp"
              className="mx-auto h-48 w-48 rounded-lg border"
            />
          </div>
        ) : aguardandoQr || provisionar.isPending ? (
          <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/30 px-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-center text-sm text-muted-foreground">
              {provisionar.isPending || reiniciarPareamento.isPending
                ? "Provisionando..."
                : obterQr.isFetching
                  ? "Sincronizando QR Code..."
                  : "Aguardando QR Code..."}
            </p>
            {estadoQr === "connecting" && (
              <p className="text-center text-xs text-muted-foreground">
                A sessão está sendo preparada. Atualizamos automaticamente a cada poucos segundos.
              </p>
            )}
            {sessaoFechada ? (
              <p className="text-center text-xs text-muted-foreground">
                Sessão desconectada no servidor. Reiniciando pareamento automaticamente...
              </p>
            ) : null}
          </div>
        ) : (
          <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/30">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
          </div>
        )}

        {pairingCode ? (
          <p className="text-center text-xs">
            Código de pareamento: <strong>{pairingCode}</strong>
          </p>
        ) : null}

        <p className="text-center text-muted-foreground">
          Escaneie o QR Code no WhatsApp → Aparelhos conectados
        </p>

        {sessaoFechada && !reiniciarPareamento.isPending ? (
          <Button variant="outline" className="w-full" onClick={tentarReiniciarPareamento}>
            Reiniciar pareamento
          </Button>
        ) : null}

        {obterQr.data?._debug ? (
          <details className="rounded-md border bg-muted/20 p-3 text-xs">
            <summary className="cursor-pointer font-medium">Debug Evolution (temporário)</summary>
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all">
              {JSON.stringify({ obterQr: obterQr.data._debug }, null, 2)}
            </pre>
          </details>
        ) : null}

        <TrocarTipoButton instanciaId={instanciaId} onSucesso={onTrocarTipo} variant="outline" />
      </CardContent>
    </Card>
  );
}
