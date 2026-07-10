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
  const resultados = await Promise.all(
    organizacoes.map(async (org) => {
      const instancias = await sincronizarInstanciasOrganizacao(org.id);
      return {
        organizacaoHash: org.id,
        operacional: instancias.some((i) => instanciaOperacional(i.status)),
      };
    }),
  );

  const destino = resultados.find((r) => r.operacional);
  return destino ? { organizacaoHash: destino.organizacaoHash } : null;
}
