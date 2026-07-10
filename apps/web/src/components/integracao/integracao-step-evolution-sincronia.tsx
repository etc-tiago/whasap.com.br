import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@whasap/ui/components/card";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

import { useAguardarMinimo } from "@/lib/integracao/use-aguardar-minimo";
import { orpc } from "@/lib/orpc";

const SINCRONIA_MS = 3000;

type Props = {
  instanciaId: string;
  organizacaoHash: string;
  onConcluir: () => void;
};

export function IntegracaoStepEvolutionSincronia({
  instanciaId,
  organizacaoHash,
  onConcluir,
}: Props) {
  const queryClient = useQueryClient();
  const pronto = useAguardarMinimo(SINCRONIA_MS);

  useQuery(
    orpc.instancia.statusConexao.queryOptions({
      input: { instanciaId },
      refetchInterval: 1500,
    }),
  );

  useEffect(() => {
    if (!pronto) return;
    void queryClient.invalidateQueries({
      queryKey: orpc.instancia.lista.key({ input: { organizacaoHash } }),
    });
    onConcluir();
  }, [pronto, onConcluir, queryClient, organizacaoHash]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sincronizando conexão</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4 py-12">
        <Loader2 className="h-10 w-10 animate-spin text-wa-green" />
        <p className="text-center text-sm text-muted-foreground">
          WhatsApp conectado. Estamos finalizando a configuração da sua instância...
        </p>
        <p className="text-center text-xs text-muted-foreground">Isso leva alguns segundos.</p>
      </CardContent>
    </Card>
  );
}
