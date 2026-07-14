import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * Layout legado de `/ajustes` — folhas fazem redirect para o modal (`?ajustes=`).
 */
export const Route = createFileRoute("/_panel/$organizacaoHash/ajustes")({
  component: () => <Outlet />,
});
