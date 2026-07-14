import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_panel/$organizacaoHash/equipe")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/$organizacaoHash/inbox",
      params: { organizacaoHash: params.organizacaoHash },
      search: { ajustes: "usuarios" },
      replace: true,
    });
  },
  component: () => null,
});
