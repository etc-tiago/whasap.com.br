import { Card, CardContent, CardHeader, CardTitle } from "@whasap/ui/components/card";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

import { useAguardarMinimo } from "@/lib/integracao/use-aguardar-minimo";

const SINCRONIA_MS = 5000;

type Props = {
  onConcluir: () => void;
};

export function IntegracaoStepEvolutionSincronia({ onConcluir }: Props) {
  const pronto = useAguardarMinimo(SINCRONIA_MS);

  useEffect(() => {
    if (pronto) onConcluir();
  }, [pronto, onConcluir]);

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
