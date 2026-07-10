import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_panel/$organizacaoHash/inbox/$instanceId/relatorios/")({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/_panel/$organizacaoHash/relatorios/"!</div>;
}
