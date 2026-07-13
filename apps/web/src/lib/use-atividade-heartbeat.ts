import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";

import { orpc } from "@/lib/orpc";

const INTERVALO_MS = 30_000;

/**
 * Envia heartbeat de atividade no painel a cada 30s enquanto a aba estiver visível.
 */
export function useAtividadeHeartbeat(ativo: boolean) {
  const registrar = useMutation(orpc.autenticacao.registrarAtividade.mutationOptions());

  useEffect(() => {
    if (!ativo) return;

    const ping = () => {
      if (document.visibilityState !== "visible") return;
      registrar.mutate({});
    };

    ping();
    const id = window.setInterval(ping, INTERVALO_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") ping();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // mutate é estável o suficiente; não dependemos de `registrar` inteiro
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só recria quando `ativo` muda
  }, [ativo]);
}
