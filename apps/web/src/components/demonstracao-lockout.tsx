import { AlertTriangle } from "lucide-react";

import type { orpcClient } from "@/lib/orpc";

type Demonstracao = Awaited<ReturnType<typeof orpcClient.organizacao.obter>>["demonstracao"];

type Props = {
  demonstracao: Demonstracao;
  isAdmin: boolean;
};

/** Overlay quando demonstração expirou — bloqueia interação com o painel. */
export function DemonstracaoLockout({ demonstracao, isAdmin }: Props) {
  if (demonstracao.estado !== "bloqueado") return null;

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-background/95 p-6 backdrop-blur-sm"
      role="alertdialog"
      aria-labelledby="lockout-title"
    >
      <div className="max-w-md space-y-4 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
        <h2 id="lockout-title" className="text-xl font-semibold">
          Acesso suspenso
        </h2>
        <p className="text-sm text-muted-foreground">
          O período de demonstração de 3 dias terminou. Nenhuma ação está disponível até configurar
          o método de pagamento.
          {!isAdmin && " Entre em contato com o administrador da organização."}
        </p>
        {isAdmin && (
          <p className="text-xs text-muted-foreground">
            Use o botão &quot;Configurar pagamento&quot; na faixa vermelha acima.
          </p>
        )}
      </div>
    </div>
  );
}
