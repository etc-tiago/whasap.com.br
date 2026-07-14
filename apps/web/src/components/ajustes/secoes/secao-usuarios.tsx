import { ConvidarMembro } from "@/components/ajustes/convidar-membro";
import { GestaoUsuarios } from "@/components/ajustes/gestao-usuarios";

type SecaoAjustesUsuariosProps = {
  convidarAberto: boolean;
};

/** Seção Usuários do modal de Ajustes. */
export function SecaoAjustesUsuarios({ convidarAberto }: SecaoAjustesUsuariosProps) {
  return <GestaoUsuarios acaoConvidar={<ConvidarMembro open={convidarAberto} />} />;
}
