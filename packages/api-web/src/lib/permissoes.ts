import type { MemberRole } from "../types";

type Acao =
  | "inbox.enviar"
  | "inbox.atribuir"
  | "inbox.fechar"
  | "inbox.nota"
  | "org.admin"
  | "relatorios.ver";

const matriz: Record<MemberRole, Acao[]> = {
  admin: [
    "inbox.enviar",
    "inbox.atribuir",
    "inbox.fechar",
    "inbox.nota",
    "org.admin",
    "relatorios.ver",
  ],
  usuario: ["inbox.enviar", "inbox.atribuir", "inbox.fechar", "inbox.nota"],
  analista: ["inbox.nota"],
};

export function pode(role: MemberRole | null, acao: Acao): boolean {
  if (!role) return false;
  return matriz[role].includes(acao);
}
