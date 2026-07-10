import { instanciaOperacional } from "@/lib/instancia-status";
import { orpcClient, type InstanciaItem } from "@/lib/orpc";

type OrganizacaoResumo = { id: string };

export type DestinoInboxOperacional = {
  organizacaoHash: string;
  instanceId: string;
};

/**
 * Busca a primeira instância operacional entre as organizações do usuário.
 * Ordem: lista de orgs → primeira instância utilizável em cada org.
 */
export async function buscarDestinoInboxOperacional(
  organizacoes: OrganizacaoResumo[],
): Promise<DestinoInboxOperacional | null> {
  for (const org of organizacoes) {
    const instancias: InstanciaItem[] = await orpcClient.instancia.lista({
      organizacaoHash: org.id,
    });
    const operacional = instancias.find((i) => instanciaOperacional(i.status));
    if (operacional) {
      return { organizacaoHash: org.id, instanceId: operacional.id };
    }
  }
  return null;
}
