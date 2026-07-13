import { createFileRoute } from "@tanstack/react-router";

import { GestaoRespostasRapidas } from "@/components/ajustes/gestao-respostas-rapidas";

export const Route = createFileRoute("/_panel/$organizacaoHash/ajustes/respostas-rapidas")({
  component: AjustesRespostasRapidasPage,
});

function AjustesRespostasRapidasPage() {
  return <GestaoRespostasRapidas />;
}
