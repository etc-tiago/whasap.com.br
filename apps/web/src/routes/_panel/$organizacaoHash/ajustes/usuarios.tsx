import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@whasap/ui/components/button";

import { ConvidarMembro } from "@/components/ajustes/convidar-membro";
import { GestaoUsuarios } from "@/components/ajustes/gestao-usuarios";
import { useOrganizacaoHash } from "@/lib/use-organizacao-hash";

export const Route = createFileRoute("/_panel/$organizacaoHash/ajustes/usuarios")({
  validateSearch: (s: Record<string, unknown>) => ({
    convidar: s.convidar === "1" || s.convidar === true || s.convidar === 1 ? "1" : "",
  }),
  component: AjustesUsuariosPage,
});

function AjustesUsuariosPage() {
  const navigate = useNavigate();
  const organizacaoHash = useOrganizacaoHash();
  const { convidar } = Route.useSearch();
  const mostrarConvite = convidar === "1";

  return (
    <div className="space-y-6">
      <GestaoUsuarios
        acaoConvidar={
          organizacaoHash && !mostrarConvite ? (
            <Button
              size="sm"
              onClick={() =>
                void navigate({
                  to: "/$organizacaoHash/ajustes/usuarios",
                  params: { organizacaoHash },
                  search: { convidar: "1" },
                })
              }
            >
              Convidar membro
            </Button>
          ) : null
        }
      />
      {mostrarConvite ? <div className="px-6 pb-6"><ConvidarMembro /></div> : null}
    </div>
  );
}
