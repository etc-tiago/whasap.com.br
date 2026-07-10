import { instanciaOperacional, instanciaPrecisaConexao } from "@/lib/instancia-status";
import { orpcClient, type InstanciaItem } from "@/lib/orpc";

type OrganizacaoResumo = { id: string };

export type DestinoInboxOperacional = {
  organizacaoHash: string;
};

/** Tenta atualizar status no banco quando Evolution já conectou mas DB ficou em provisioning. */
async function sincronizarInstanciasOrganizacao(organizacaoHash: string): Promise<InstanciaItem[]> {
  const instancias = await orpcClient.instancia.lista({ organizacaoHash });

  const pendentes = instancias.filter(
    (i) => !instanciaOperacional(i.status) && instanciaPrecisaConexao(i.status),
  );

  if (pendentes.length === 0) return instancias;

  await Promise.allSettled(
    pendentes.map((i) => orpcClient.instancia.statusConexao({ instanciaId: i.id })),
  );

  return orpcClient.instancia.lista({ organizacaoHash });
}

/**
 * Busca a primeira instância operacional entre as organizações do usuário.
 * Sincroniza status com Evolution antes de decidir o destino.
 */
export async function buscarDestinoInboxOperacional(
  organizacoes: OrganizacaoResumo[],
): Promise<DestinoInboxOperacional | null> {
  for (const org of organizacoes) {
    const instancias = await sincronizarInstanciasOrganizacao(org.id);
    const operacional = instancias.find((i) => instanciaOperacional(i.status));
    if (operacional) {
      return { organizacaoHash: org.id };
    }
  }
  return null;
}
