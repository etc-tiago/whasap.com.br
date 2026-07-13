import { createFileRoute } from "@tanstack/react-router";

import { GestaoUsuarios } from "@/components/ajustes/gestao-usuarios";

export const Route = createFileRoute("/_panel/$organizacaoHash/ajustes/usuarios")({
  component: AjustesUsuariosPage,
});

function AjustesUsuariosPage() {
  return <GestaoUsuarios />;
}
