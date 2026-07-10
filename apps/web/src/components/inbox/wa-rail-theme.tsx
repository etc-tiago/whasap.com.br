import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@whasap/ui/components/dropdown-menu";
import { Monitor, Moon, Sun } from "lucide-react";

import { useTema, type TemaPreferencia } from "@/lib/tema";

const OPCOES: Array<{ valor: TemaPreferencia; rotulo: string; icone: typeof Sun }> = [
  { valor: "light", rotulo: "Claro", icone: Sun },
  { valor: "dark", rotulo: "Escuro", icone: Moon },
  { valor: "system", rotulo: "Sistema", icone: Monitor },
];

export function WaRailTheme() {
  const { preferencia, setPreferencia } = useTema();
  const IconeAtivo = OPCOES.find((o) => o.valor === preferencia)?.icone ?? Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Tema da interface"
          className="relative flex h-11 w-11 items-center justify-center rounded-lg text-wa-icon transition-colors hover:bg-wa-hover"
        >
          <IconeAtivo className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-44">
        <DropdownMenuLabel>Tema</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={preferencia}
          onValueChange={(v) => setPreferencia(v as TemaPreferencia)}
        >
          {OPCOES.map(({ valor, rotulo, icone: Icone }) => (
            <DropdownMenuRadioItem key={valor} value={valor} className="gap-2">
              <Icone className="h-4 w-4" />
              {rotulo}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
