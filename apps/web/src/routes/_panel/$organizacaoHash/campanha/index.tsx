import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { WaCampanhaForm } from "@/components/campanha/wa-campanha-form";
import { instanciaOperacional } from "@/lib/instancia-status";
import { orgInput } from "@/lib/org-input";
import { orpc } from "@/lib/orpc";
import { useOrganizacaoHash } from "@/lib/use-organizacao-hash";

export const Route = createFileRoute("/_panel/$organizacaoHash/campanha/")({
  component: CampanhaEnvioPage,
});

function CampanhaEnvioPage() {
  const organizacaoHash = useOrganizacaoHash();
  const navigate = useNavigate();

  const org = useQuery(
    orpc.organizacao.obter.queryOptions({
      input: orgInput(organizacaoHash),
    }),
  );
  const instancias = useQuery(
    orpc.instancia.lista.queryOptions({
      input: orgInput(organizacaoHash),
    }),
  );

  if (!organizacaoHash) return null;

  const instanciasOperacionais = (instancias.data ?? [])
    .filter((i) => instanciaOperacional(i.status))
    .map((i) => ({
      id: i.id,
      nome: i.nome,
      icone: i.icone,
      provider: i.provider,
    }));

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6">
      <div>
        <h2 className="text-lg font-semibold text-wa-text">Envio rápido</h2>
        <p className="mt-1 text-sm text-wa-text-muted">
          Informe nome, telefone e mensagem. O envio é imediato.
        </p>
      </div>
      {instanciasOperacionais.length === 0 ? (
        <p className="text-sm text-wa-text-muted">Nenhuma conexão operacional disponível.</p>
      ) : (
        <WaCampanhaForm
          organizacaoHash={organizacaoHash}
          instancias={instanciasOperacionais}
          alertaConsecutivos={org.data?.campanhaAlertaConsecutivos}
          onEnviado={(conversaId) => {
            void navigate({
              to: "/$organizacaoHash/inbox",
              params: { organizacaoHash },
              search: { conversa: conversaId },
            });
          }}
        />
      )}
    </div>
  );
}
