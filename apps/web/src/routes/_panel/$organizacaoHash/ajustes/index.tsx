import { createFileRoute } from "@tanstack/react-router";

import { BlocoOrganizacao } from "@/components/ajustes/bloco-organizacao";
import { BlocoUsuario } from "@/components/ajustes/bloco-usuario";

export const Route = createFileRoute("/_panel/$organizacaoHash/ajustes/")({
  component: AjustesIndexPage,
});

function AjustesIndexPage() {
  return (
    <div className="max-w-lg space-y-6 p-6">
      <BlocoOrganizacao />
      <BlocoUsuario />
    </div>
  );
}
