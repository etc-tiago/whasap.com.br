import { createFileRoute } from "@tanstack/react-router";

import { GestaoEtiquetas } from "@/components/etiquetas/gestao-etiquetas";

export const Route = createFileRoute("/_panel/$organizacaoHash/etiquetas")({
  component: EtiquetasPage,
});

function EtiquetasPage() {
  return (
    <div className="h-full min-h-0 overflow-hidden">
      <GestaoEtiquetas />
    </div>
  );
}
