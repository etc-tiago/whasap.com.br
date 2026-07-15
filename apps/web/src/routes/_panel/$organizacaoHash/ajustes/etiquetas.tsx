import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_panel/$organizacaoHash/ajustes/etiquetas")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/$organizacaoHash/etiquetas",
      params: { organizacaoHash: params.organizacaoHash },
      replace: true,
    });
  },
});
