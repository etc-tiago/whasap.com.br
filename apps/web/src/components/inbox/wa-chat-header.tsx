import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@whasap/ui/components/dropdown-menu";
import { ArrowLeft, MoreVertical, Search, Video } from "lucide-react";

import { WaAtribuirPopover } from "@/components/inbox/wa-atribuir-popover";
import { WaEtiquetasPopover } from "@/components/inbox/wa-etiquetas-popover";
import { WaIconButton } from "@/components/inbox/wa-icon-button";
import { WaJanelaCloudCountdown } from "@/components/inbox/wa-janela-cloud-countdown";
import { WaNomeContatoEditor } from "@/components/inbox/wa-nome-contato-editor";
import { corAvatarContato, estiloAvatarContato } from "@/lib/inbox-utils";
import type { ConversaItem } from "@/lib/orpc";

type Membro = {
  id: string;
  usuarioId: string;
  usuarioNome?: string | null | undefined;
  role: string;
};

type WaChatHeaderProps = {
  conversa: ConversaItem;
  instanciaId: string;
  organizacaoHash: string;
  membros: Membro[];
  podeAtribuir?: boolean;
  podeEtiquetar?: boolean;
  onFechar: () => void;
  onVoltarMobile?: () => void;
};

export function WaChatHeader({
  conversa,
  instanciaId,
  organizacaoHash,
  membros,
  podeAtribuir = true,
  podeEtiquetar = true,
  onFechar,
  onVoltarMobile,
}: WaChatHeaderProps) {
  const nome = conversa.contatoNome ?? conversa.contatoTelefone;
  const cor = corAvatarContato(conversa.contatoId);

  return (
    <WaEtiquetasPopover
      organizacaoHash={organizacaoHash}
      contatoId={conversa.contatoId}
      disabled={!podeEtiquetar}
    >
      <header className="flex items-center justify-between border-l border-wa-divider bg-wa-panel-header px-3 py-2.5 md:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {onVoltarMobile ? (
            <button
              type="button"
              onClick={onVoltarMobile}
              className="rounded-full p-1.5 text-wa-icon hover:bg-wa-hover md:hidden"
              aria-label="Voltar para conversas"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : null}
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
            style={estiloAvatarContato(cor)}
          >
            {nome.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <WaNomeContatoEditor
              contatoId={conversa.contatoId}
              contatoNome={conversa.contatoNome}
              contatoTelefone={conversa.contatoTelefone}
              instanciaId={instanciaId}
              disabled={!podeEtiquetar}
            />
            {conversa.janelaCloudExpiraEm ? (
              <WaJanelaCloudCountdown expiraEm={conversa.janelaCloudExpiraEm} />
            ) : null}
            <WaEtiquetasPopover.Resumo />
            <WaAtribuirPopover
              conversaId={conversa.id}
              instanciaId={instanciaId}
              usuarioAtribuidoId={conversa.usuarioAtribuidoId}
              usuarioAtribuidoNome={conversa.usuarioAtribuidoNome}
              membros={membros}
              disabled={!podeAtribuir}
            />
          </div>
        </div>
        <div className="flex items-center gap-1 text-wa-icon">
          <WaEtiquetasPopover.Icone />
          <WaIconButton disabled label="Chamada de vídeo">
            <Video className="h-5 w-5" />
          </WaIconButton>
          <WaIconButton disabled label="Buscar na conversa">
            <Search className="h-5 w-5" />
          </WaIconButton>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-full text-wa-icon transition-colors hover:bg-wa-hover"
                aria-label="Mais opções"
              >
                <MoreVertical className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={onFechar}
              >
                Fechar conversa
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
    </WaEtiquetasPopover>
  );
}
