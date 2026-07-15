/**
 * Caixa de entrada — lista sem conversa selecionada.
 * Deep-link legado `?conversa=` redireciona para `/chat/$conversaId`.
 * `telefone`+`instancia` abrem nova conversa (ex.: Contatos).
 */
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";

import { InboxOrgPage } from "@/components/inbox/inbox-org-page";
import { useOrganizacaoHash } from "@/lib/use-organizacao-hash";

type InboxSearch = {
  conversa?: string;
  telefone?: string;
  instancia?: string;
};

export const Route = createFileRoute("/_panel/$organizacaoHash/inbox/")({
  validateSearch: (s: Record<string, unknown>): InboxSearch => ({
    conversa: typeof s.conversa === "string" && s.conversa ? s.conversa : undefined,
    telefone: typeof s.telefone === "string" && s.telefone ? s.telefone : undefined,
    instancia: typeof s.instancia === "string" && s.instancia ? s.instancia : undefined,
  }),
  component: InboxRoutePage,
});

function InboxRoutePage() {
  const navigate = useNavigate();
  const organizacaoHash = useOrganizacaoHash();
  const search = Route.useSearch();

  if (search.conversa && organizacaoHash) {
    return (
      <Navigate
        to="/$organizacaoHash/chat/$conversaId"
        params={{ organizacaoHash, conversaId: search.conversa }}
        replace
      />
    );
  }

  return (
    <InboxOrgPage
      selectedId={null}
      onSelecionarConversa={(conversaId) => {
        if (!organizacaoHash) return;
        void navigate({
          to: "/$organizacaoHash/chat/$conversaId",
          params: { organizacaoHash, conversaId },
        });
      }}
      onLimparSelecao={() => {
        if (!organizacaoHash) return;
        void navigate({
          to: "/$organizacaoHash/inbox",
          params: { organizacaoHash },
          search: {},
        });
      }}
      telefone={search.telefone}
      instancia={search.instancia}
      onLimparSearchNovaConversa={() => {
        if (!organizacaoHash) return;
        if (!search.telefone && !search.instancia) return;
        void navigate({
          to: "/$organizacaoHash/inbox",
          params: { organizacaoHash },
          search: {},
          replace: true,
        });
      }}
    />
  );
}
