import { Button } from "@whasap/ui/components/button";
import {
  Panel,
  PanelMain,
  PanelSidebar,
  PanelSidebarActions,
  PanelSidebarContent,
  PanelSidebarHeader,
  PanelSidebarTitle,
} from "@whasap/ui/components/panel";
import { Plus, Tag } from "lucide-react";
import { useState } from "react";

import { DetalheEtiqueta } from "@/components/etiquetas/detalhe-etiqueta";
import { DialogEtiqueta } from "@/components/etiquetas/dialog-etiqueta";
import { ListaEtiquetas } from "@/components/etiquetas/lista-etiquetas";
import { useSession } from "@/lib/auth";
import { useOrganizacaoHash } from "@/lib/use-organizacao-hash";

/**
 * Gestão de etiquetas em layout master-detail (`Panel*`).
 * Lista + busca na sidebar; resumo e contatos paginados no main; edição via Dialog.
 */
export function GestaoEtiquetas() {
  const organizacaoHash = useOrganizacaoHash();
  const { data: session } = useSession();
  const papel = session?.role;
  const podeEditar = papel === "admin" || papel === "usuario";

  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
  const [dialogNova, setDialogNova] = useState(false);

  if (!organizacaoHash) return null;

  return (
    <>
      <Panel activePane={selecionadaId ? "main" : "sidebar"} className="h-full w-full">
        <PanelSidebar className="border-wa-divider bg-wa-panel md:w-80 xl:w-96">
          <PanelSidebarHeader>
            <div className="min-w-0">
              <PanelSidebarTitle className="text-lg text-wa-text">Etiquetas</PanelSidebarTitle>
              <p className="mt-1 text-xs text-wa-text-muted">Organize contatos por categoria.</p>
            </div>
            <PanelSidebarActions>
              {podeEditar ? (
                <Button size="sm" onClick={() => setDialogNova(true)}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Nova
                </Button>
              ) : null}
            </PanelSidebarActions>
          </PanelSidebarHeader>

          <PanelSidebarContent className="px-3 pb-4">
            <ListaEtiquetas
              organizacaoHash={organizacaoHash}
              selecionadaId={selecionadaId}
              onSelecionar={setSelecionadaId}
            />
          </PanelSidebarContent>
        </PanelSidebar>

        <PanelMain className="bg-wa-panel">
          {selecionadaId ? (
            <DetalheEtiqueta
              key={selecionadaId}
              organizacaoHash={organizacaoHash}
              etiquetaId={selecionadaId}
              podeEditar={podeEditar}
              onExcluida={() => setSelecionadaId(null)}
              onVoltar={() => setSelecionadaId(null)}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <Tag className="mb-3 size-10 text-wa-icon" />
              <h2 className="text-lg font-medium text-wa-text">Nenhuma etiqueta selecionada</h2>
              <p className="mt-2 max-w-sm text-sm text-wa-text-muted">
                Escolha uma etiqueta na lista para ver o resumo e os contatos
                {podeEditar ? ", ou crie uma nova." : "."}
              </p>
              {podeEditar ? (
                <Button className="mt-4" size="sm" onClick={() => setDialogNova(true)}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Nova etiqueta
                </Button>
              ) : null}
            </div>
          )}
        </PanelMain>
      </Panel>

      {podeEditar ? (
        <DialogEtiqueta
          organizacaoHash={organizacaoHash}
          aberto={dialogNova}
          onAbertoChange={setDialogNova}
          etiqueta={null}
          onCriada={(id) => setSelecionadaId(id)}
        />
      ) : null}
    </>
  );
}
