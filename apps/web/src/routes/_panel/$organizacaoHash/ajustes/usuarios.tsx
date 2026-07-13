import { createFileRoute } from "@tanstack/react-router";

import { ConvidarMembro } from "@/components/ajustes/convidar-membro";
import { GestaoUsuarios } from "@/components/ajustes/gestao-usuarios";

export const Route = createFileRoute("/_panel/$organizacaoHash/ajustes/usuarios")({
  validateSearch: (s: Record<string, unknown>) => ({
    convidar: s.convidar === "1" || s.convidar === true || s.convidar === 1 ? "1" : "",
  }),
  component: AjustesUsuariosPage,
});

function AjustesUsuariosPage() {
  const { convidar } = Route.useSearch();

  return <GestaoUsuarios acaoConvidar={<ConvidarMembro open={convidar === "1"} />} />;
}
