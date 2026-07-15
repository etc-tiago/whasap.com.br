import { createFileRoute } from "@tanstack/react-router";

import { GestaoRespostasRapidas } from "@/components/ajustes/gestao-respostas-rapidas";

export const Route = createFileRoute("/_panel/$organizacaoHash/respostas-rapidas")({
  component: RespostasRapidasPage,
});

function RespostasRapidasPage() {
  return (
    <div className="h-full min-h-0 overflow-hidden">
      <GestaoRespostasRapidas />
    </div>
  );
}
