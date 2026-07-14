import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_panel/$organizacaoHash/ajustes/respostas-rapidas")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/$organizacaoHash/respostas-rapidas",
      params: { organizacaoHash: params.organizacaoHash },
      replace: true,
    });
  },
});
