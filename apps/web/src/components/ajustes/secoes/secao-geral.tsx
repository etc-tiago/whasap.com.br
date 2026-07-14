import { BlocoOrganizacao } from "@/components/ajustes/bloco-organizacao";
import { BlocoUsuario } from "@/components/ajustes/bloco-usuario";

/** Seção Geral do modal de Ajustes. */
export function SecaoAjustesGeral() {
  return (
    <div className="max-w-lg space-y-6 p-6">
      <BlocoOrganizacao />
      <BlocoUsuario />
    </div>
  );
}
