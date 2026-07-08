import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { orpc } from "@/lib/orpc";

type Props = {
  onDone: (hasOrg: boolean) => void;
};

export function EntradaStepVerificando({ onDone }: Props) {
  const orgs = useQuery(orpc.organizacao.lista.queryOptions());

  useEffect(() => {
    if (!orgs.isSuccess) return;
    onDone(orgs.data.length > 0);
  }, [orgs.isSuccess, orgs.data, onDone]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
      <Loader2 className="h-10 w-10 animate-spin text-wa-green" />
      <div>
        <h1 className="text-lg font-semibold text-wa-text">Preparando seu espaço</h1>
        <p className="mt-1 text-sm text-wa-muted">Verificando sua conta...</p>
      </div>
    </div>
  );
}
