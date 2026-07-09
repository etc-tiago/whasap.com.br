import { Card, CardContent } from "@whasap/ui/components/card";
import { Check } from "lucide-react";
import { useEffect } from "react";

type Props = {
  onRedirecionar: () => void;
};

export function IntegracaoStepConcluido({ onRedirecionar }: Props) {
  useEffect(() => {
    const t = setTimeout(onRedirecionar, 2000);
    return () => clearTimeout(t);
  }, [onRedirecionar]);

  return (
    <Card>
      <CardContent className="space-y-4 py-8 text-center">
        <Check className="mx-auto h-12 w-12 text-wa-green" />
        <h2 className="text-xl font-semibold">Tudo pronto!</h2>
        <p className="text-sm text-muted-foreground">
          Você tem 3 dias de demonstração gratuita. Redirecionando para o painel...
        </p>
      </CardContent>
    </Card>
  );
}
