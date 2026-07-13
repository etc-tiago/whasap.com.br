import { Button } from "@whasap/ui/components/button";
import { Plus } from "lucide-react";
import { useState } from "react";

import { useSession } from "@/lib/auth";
import { useOrganizacaoHash } from "@/lib/use-organizacao-hash";

import { EditorRespostaRapida } from "./editor-resposta-rapida";
import { ListaRespostasRapidas } from "./lista-respostas-rapidas";

/**
 * Shell da gestão de respostas rápidas.
 * Papel via `useSession` (sem query extra); lista e editor em filhos.
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
    <div className="flex h-full flex-col p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-wa-text">Respostas rápidas</h2>
          <p className="mt-1 text-sm text-wa-text-muted">
            Cadastre textos, imagens ou documentos — sozinhos ou em sequência — para usar na caixa
            de entrada.
          </p>
        </div>
        <Button size="sm" onClick={abrirCriar} disabled={!podeEditar}>
          <Plus className="mr-1.5 h-4 w-4" />
          Nova
        </Button>
      </div>

      <ListaRespostasRapidas
        organizacaoHash={organizacaoHash}
        enabled={podeEditar}
        onEditar={abrirEditar}
      />

      <EditorRespostaRapida
        organizacaoHash={organizacaoHash}
        aberto={editorAberto}
        respostaId={editandoId}
        onFechar={fecharEditor}
      />
    </div>
  );
}
