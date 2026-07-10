/**
 * Redireciona inbox legado por instância para a lista unificada da organização.
 */
import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_panel/$organizacaoHash/inbox/$instanceId/")({
  component: InboxInstanceRedirect,
});

function InboxInstanceRedirect() {
  const { organizacaoHash } = Route.useParams();

  return <Navigate to="/$organizacaoHash/inbox" params={{ organizacaoHash }} replace />;
}
