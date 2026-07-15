import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isEvoProvider } from "@whasap/config";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@whasap/ui/components/dropdown-menu";
import { ArrowLeft, History, Megaphone, MoreVertical, Search, Video } from "lucide-react";

import { WaAtribuirPopover } from "@/components/inbox/wa-atribuir-popover";
import { WaEtiquetasPopover } from "@/components/inbox/wa-etiquetas-popover";
import { WaIconButton } from "@/components/inbox/wa-icon-button";
import { WaJanelaCloudCountdown } from "@/components/inbox/wa-janela-cloud-countdown";
import { WaNomeContatoEditor } from "@/components/inbox/wa-nome-contato-editor";
import { corAvatarContato, estiloAvatarContato } from "@/lib/inbox-utils";
import { orpc } from "@/lib/orpc";
import { getOrpcErrorMessage } from "@/lib/orpc-error";
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
  provedor?: string;
  membros: Membro[];
  podeAtribuir?: boolean;
  podeEtiquetar?: boolean;
  onFechar: () => void;
  onVoltarMobile?: () => void;
  /** Exibe botão para abrir/fechar o painel de campanha. */
  campanhaDisponivel?: boolean;
  campanhaAberta?: boolean;
  onToggleCampanha?: () => void;
};

export function WaChatHeader({
  conversa,
  instanciaId,
  organizacaoHash,
  provedor,
  membros,
  podeAtribuir = true,
  podeEtiquetar = true,
  onFechar,
  onVoltarMobile,
  campanhaDisponivel,
  campanhaAberta,
  onToggleCampanha,
}: WaChatHeaderProps) {
  const queryClient = useQueryClient();
  const nome = conversa.contatoNome ?? conversa.contatoTelefone;
  const cor = corAvatarContato(conversa.contatoId);
  const isEvo = isEvoProvider(provedor ?? "");

  const sincronizarHistorico = useMutation(
    orpc.caixaEntrada.conversas.sincronizarHistorico.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.caixaEntrada.mensagens.lista.key({
            input: { conversaId: conversa.id },
          }),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.caixaEntrada.conversas.lista.key(),
        });
      },
    }),
  );

  return (
    <WaEtiquetasPopover
      organizacaoHash={organizacaoHash}
      contatoId={conversa.contatoId}
      instanciaId={instanciaId}
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
            {conversa.metaCloudJanelaExpiraEm ? (
              <WaJanelaCloudCountdown expiraEm={conversa.metaCloudJanelaExpiraEm} />
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
          {campanhaDisponivel && onToggleCampanha ? (
            <WaIconButton
              label={campanhaAberta ? "Fechar campanha" : "Abrir campanha"}
              onClick={onToggleCampanha}
              className={campanhaAberta ? "bg-wa-hover text-wa-green-dark" : undefined}
            >
              <Megaphone className="h-5 w-5" />
            </WaIconButton>
          ) : null}
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
              {isEvo ? (
                <DropdownMenuItem
                  disabled={sincronizarHistorico.isPending}
                  onSelect={() => sincronizarHistorico.mutate({ conversaId: conversa.id })}
                >
                  <History className="mr-2 h-4 w-4" />
                  {sincronizarHistorico.isPending
                    ? "Sincronizando histórico..."
                    : "Sincronizar histórico"}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={onFechar}
              >
                Fechar conversa
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {sincronizarHistorico.error ? (
            <p className="sr-only">
              {getOrpcErrorMessage(sincronizarHistorico.error, "Erro ao sincronizar histórico")}
            </p>
          ) : null}
        </div>
      </header>
    </WaEtiquetasPopover>
  );
}
