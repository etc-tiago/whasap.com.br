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
import { Plus } from "lucide-react";
import { useState } from "react";

import { useSession } from "@/lib/auth";
import { useOrganizacaoHash } from "@/lib/use-organizacao-hash";

import { EditorRespostaRapida } from "./editor-resposta-rapida";
import { ListaRespostasRapidas } from "./lista-respostas-rapidas";

/**
 * Gestão de respostas rápidas em layout master-detail (`Panel*`).
 * Papel via `useSession` (sem query extra); lista na sidebar, editor no main.
 */
export function GestaoRespostasRapidas() {
  const organizacaoHash = useOrganizacaoHash();
  const { data: session } = useSession();
  const papel = session?.role;
  const podeEditar = papel === "admin" || papel === "usuario";

  const [editorAberto, setEditorAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  function fecharEditor() {
    setEditorAberto(false);
    setEditandoId(null);
  }

  function abrirCriar() {
    setEditandoId(null);
    setEditorAberto(true);
  }

  function abrirEditar(id: string) {
    setEditandoId(id);
    setEditorAberto(true);
  }

  if (!organizacaoHash) return null;

  if (papel && !podeEditar) {
    return (
      <div className="p-6">
        <h2 className="text-lg font-semibold text-wa-text">Respostas rápidas</h2>
        <p className="mt-2 text-sm text-wa-text-muted">
          Seu papel não permite cadastrar respostas rápidas.
        </p>
      </div>
    );
  }

  return (
    <Panel activePane={editorAberto ? "main" : "sidebar"} className="h-full w-full">
      <PanelSidebar className="border-wa-divider bg-wa-panel md:w-80 xl:w-96">
        <PanelSidebarHeader>
          <div className="min-w-0">
            <PanelSidebarTitle className="text-lg text-wa-text">Respostas rápidas</PanelSidebarTitle>
            <p className="mt-1 text-xs text-wa-text-muted">
              Textos, imagens ou documentos para a caixa de entrada.
            </p>
          </div>
          <PanelSidebarActions>
            <Button size="sm" onClick={abrirCriar} disabled={!podeEditar}>
              <Plus className="mr-1.5 h-4 w-4" />
              Nova
            </Button>
          </PanelSidebarActions>
        </PanelSidebarHeader>

        <PanelSidebarContent className="px-3 pb-4">
          <ListaRespostasRapidas
            organizacaoHash={organizacaoHash}
            enabled={podeEditar}
            onEditar={abrirEditar}
          />
        </PanelSidebarContent>
      </PanelSidebar>

      <PanelMain className="bg-wa-panel">
        {editorAberto ? (
          <EditorRespostaRapida
            key={editandoId ?? "nova"}
            organizacaoHash={organizacaoHash}
            respostaId={editandoId}
            onFechar={fecharEditor}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <h2 className="text-lg font-medium text-wa-text">Nenhuma resposta selecionada</h2>
            <p className="mt-2 max-w-sm text-sm text-wa-text-muted">
              Escolha uma resposta na lista ou crie uma nova para editar aqui.
            </p>
            <Button className="mt-4" size="sm" onClick={abrirCriar} disabled={!podeEditar}>
              <Plus className="mr-1.5 h-4 w-4" />
              Nova resposta
            </Button>
          </div>
        )}
      </PanelMain>
    </Panel>
  );
}
