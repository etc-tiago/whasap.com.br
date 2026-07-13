import { createFileRoute, Navigate } from "@tanstack/react-router";

/** Relatórios ficam na rota da organização; esta rota só redireciona. */
export const Route = createFileRoute("/_panel/$organizacaoHash/inbox/$instanceId/relatorios/")({
  component: RelatoriosRedirect,
});

function RelatoriosRedirect() {
  const { organizacaoHash } = Route.useParams();
  return <Navigate to="/$organizacaoHash/relatorios" params={{ organizacaoHash }} />;
}
