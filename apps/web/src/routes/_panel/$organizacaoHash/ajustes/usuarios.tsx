import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_panel/$organizacaoHash/ajustes/usuarios")({
  validateSearch: (s: Record<string, unknown>) => ({
    convidar: s.convidar === "1" || s.convidar === true || s.convidar === 1 ? ("1" as const) : "",
  }),
  beforeLoad: ({ params, search }) => {
    throw redirect({
      to: "/$organizacaoHash/inbox",
      params: { organizacaoHash: params.organizacaoHash },
      search: {
        ajustes: "usuarios",
        ...(search.convidar === "1" ? { convidar: "1" as const } : {}),
      },
      replace: true,
    });
  },
});
