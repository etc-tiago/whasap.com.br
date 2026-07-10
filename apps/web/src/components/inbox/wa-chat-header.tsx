import { Button } from "@whasap/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@whasap/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@whasap/ui/components/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@whasap/ui/components/select";
import { ArrowLeft, MoreVertical, Search, Video } from "lucide-react";

import { WaIconButton } from "@/components/inbox/wa-icon-button";
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
  membros: Membro[];
  assignOpen: boolean;
  assignUserId: string;
  onAssignOpenChange: (open: boolean) => void;
  onAssignUserIdChange: (id: string) => void;
  onAtribuir: () => void;
  onFechar: () => void;
  onVoltarMobile?: () => void;
};

export function WaChatHeader({
  conversa,
  membros,
  assignOpen,
  assignUserId,
  onAssignOpenChange,
  onAssignUserIdChange,
  onAtribuir,
  onFechar,
  onVoltarMobile,
}: WaChatHeaderProps) {
  const nome = conversa.contatoNome ?? conversa.contatoTelefone;
  const cor = corAvatarContato(conversa.contatoId);

  return (
    <>
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
            <p className="truncate text-[15px] font-medium text-wa-text">{nome}</p>
            {conversa.janelaCloudExpiraEm ? (
              <p className="truncate text-xs text-wa-text-muted">
                Janela 24h até{" "}
                {new Date(conversa.janelaCloudExpiraEm).toLocaleString("pt-BR")}
              </p>
            ) : null}
            {conversa.usuarioAtribuidoNome ? (
              <p className="truncate text-xs text-wa-text-muted">
                Atribuído: {conversa.usuarioAtribuidoNome}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-1 text-wa-icon">
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
              <DropdownMenuItem onSelect={() => onAssignOpenChange(true)}>
                Atribuir conversa
              </DropdownMenuItem>
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

      <Dialog open={assignOpen} onOpenChange={onAssignOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atribuir conversa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={assignUserId} onValueChange={onAssignUserIdChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um agente" />
              </SelectTrigger>
              <SelectContent>
                {membros.map((m) => (
                  <SelectItem key={m.id} value={m.usuarioId}>
                    {m.usuarioNome ?? m.usuarioId.slice(0, 8)} ({m.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={onAtribuir}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
