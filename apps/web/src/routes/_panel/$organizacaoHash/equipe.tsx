import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_panel/$organizacaoHash/equipe")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/$organizacaoHash/ajustes/usuarios",
      params: { organizacaoHash: params.organizacaoHash },
      replace: true,
    });
  },
  component: () => null,
});
