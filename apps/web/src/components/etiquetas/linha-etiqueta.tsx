import { Badge } from "@whasap/ui/components/badge";
import { cn } from "@whasap/ui/lib/utils";

type LinhaEtiquetaProps = {
  id: string;
  nome: string;
  cor: string | null;
  contatosContagem: number;
  selecionada: boolean;
  onSelecionar: (id: string) => void;
};

export function LinhaEtiqueta({
  id,
  nome,
  cor,
  contatosContagem,
  selecionada,
  onSelecionar,
}: LinhaEtiquetaProps) {
  return (
    <button
      type="button"
      onClick={() => onSelecionar(id)}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors",
        selecionada ? "bg-wa-chip-active" : "hover:bg-wa-hover",
      )}
    >
      <span
        className="size-3 shrink-0 rounded-full"
        style={{ backgroundColor: cor ?? "var(--wa-primary)" }}
      />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-wa-text">{nome}</span>
      <Badge
        variant="secondary"
        className="shrink-0 border-0 bg-wa-chip px-1.5 py-0 text-[10px] font-medium text-wa-text-muted"
      >
        {contatosContagem}
      </Badge>
    </button>
  );
}
