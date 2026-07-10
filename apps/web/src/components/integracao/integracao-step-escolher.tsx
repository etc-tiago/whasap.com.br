import { Button } from "@whasap/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@whasap/ui/components/card";
import { Badge } from "@whasap/ui/components/badge";

import { rotuloWhatsApp } from "@whasap/config";

import { rotulosStatusInstancia } from "@/lib/instancia-status";
import type { InstanciaItem } from "@/lib/orpc";

type Props = {
  instancias: InstanciaItem[];
  onSelecionar: (id: string, provider: string) => void;
  onNova: () => void;
};

export function IntegracaoStepEscolher({ instancias, onSelecionar, onNova }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Escolha o WhatsApp para reconectar</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Selecione uma instância desconectada ou adicione um novo WhatsApp.
        </p>
        <div className="space-y-2">
          {instancias.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelecionar(item.id, item.provider)}
              className="flex w-full items-center justify-between rounded-lg border p-4 text-left transition hover:border-wa-green hover:bg-wa-green/5"
            >
              <div>
                <p className="font-medium">{item.nome}</p>
                <p className="text-xs text-muted-foreground">{rotuloWhatsApp(item.provider)}</p>
              </div>
              <Badge variant="outline">{rotulosStatusInstancia[item.status] ?? item.status}</Badge>
            </button>
          ))}
        </div>
        <Button variant="outline" className="w-full" onClick={onNova}>
          Adicionar novo WhatsApp
        </Button>
      </CardContent>
    </Card>
  );
}
