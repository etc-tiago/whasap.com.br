import { ICONES_CONEXAO, type IconeConexao } from "@whasap/config";
import { Input } from "@whasap/ui/components/input";
import { Label } from "@whasap/ui/components/label";
import { cn } from "@whasap/ui/lib/utils";

import { IconeConexaoLucide } from "@/lib/icones-conexao";

type Props = {
  nome: string;
  icone: IconeConexao;
  onNomeChange: (nome: string) => void;
  onIconeChange: (icone: IconeConexao) => void;
  disabled?: boolean;
};

export function ConexaoIdentidadeFields({
  nome,
  icone,
  onNomeChange,
  onIconeChange,
  disabled,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="conexao-nome">Nome da conexão</Label>
        <Input
          id="conexao-nome"
          value={nome}
          disabled={disabled}
          onChange={(e) => onNomeChange(e.target.value)}
          placeholder="Atendimento"
          minLength={2}
        />
      </div>
      <div className="space-y-2">
        <Label>Ícone</Label>
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
          {ICONES_CONEXAO.map((nomeIcone) => (
            <button
              key={nomeIcone}
              type="button"
              disabled={disabled}
              title={nomeIcone}
              onClick={() => onIconeChange(nomeIcone)}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg border transition",
                icone === nomeIcone
                  ? "border-wa-green bg-wa-green/10 text-wa-green-dark"
                  : "border-border text-wa-icon hover:border-wa-green/50 hover:bg-wa-hover",
                disabled && "opacity-50",
              )}
            >
              <IconeConexaoLucide nome={nomeIcone} className="h-5 w-5" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
