import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_panel/$organizacaoHash/ajustes/usuarios")({
  component: AjustesUsuariosPage,
});

function AjustesUsuariosPage() {
  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-wa-text">Usuários</h2>
      <p className="mt-2 text-sm text-wa-text-muted">Em breve.</p>
    </div>
  );
}
