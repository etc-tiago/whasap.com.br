import { Button } from "@whasap/ui/components/button";
import { Textarea } from "@whasap/ui/components/textarea";
import { ArrowDown, ArrowUp, Trash2, type LucideIcon } from "lucide-react";

import { rotuloTipo, type ItemForm } from "./tipos";

type CabecalhoItemProps = {
  indice: number;
  total: number;
  rotulo: string;
  icone?: LucideIcon;
  onMover: (direcao: -1 | 1) => void;
  onRemover: () => void;
};

export function CabecalhoItem({
  indice,
  total,
  rotulo,
  icone: Icone,
  onMover,
  onRemover,
}: CabecalhoItemProps) {
  return (
    <div className="mb-2 flex items-center gap-2">
      {Icone ? <Icone className="h-4 w-4 text-wa-icon" /> : null}
      <span className="text-xs font-medium text-wa-text-muted">
        {indice + 1}. {rotulo}
      </span>
      <div className="ml-auto flex items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={indice === 0}
          onClick={() => onMover(-1)}
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={indice >= total - 1}
          onClick={() => onMover(1)}
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive"
          disabled={total <= 1}
          onClick={onRemover}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

type ItemRespostaTextoProps = {
  item: ItemForm;
  indice: number;
  total: number;
  onChange: (patch: Partial<ItemForm>) => void;
  onMover: (direcao: -1 | 1) => void;
  onRemover: () => void;
};

/** Item de texto da sequência — sem hooks de dados. */
export function ItemRespostaTexto({
  item,
  indice,
  total,
  onChange,
  onMover,
  onRemover,
}: ItemRespostaTextoProps) {
  return (
    <div className="rounded-lg border border-wa-divider bg-wa-hover/40 p-3">
      <CabecalhoItem
        indice={indice}
        total={total}
        rotulo={rotuloTipo("text")}
        onMover={onMover}
        onRemover={onRemover}
      />
      <Textarea
        value={item.corpo}
        onChange={(e) => onChange({ corpo: e.target.value })}
        rows={3}
        placeholder="Texto da mensagem"
      />
    </div>
  );
}
