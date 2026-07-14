import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_panel/$organizacaoHash/ajustes/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/$organizacaoHash/inbox",
      params: { organizacaoHash: params.organizacaoHash },
      search: { ajustes: "geral" },
      replace: true,
    });
  },
});
