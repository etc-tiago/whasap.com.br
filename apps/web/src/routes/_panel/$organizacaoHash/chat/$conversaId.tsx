/**
 * Conversa selecionada na caixa de entrada — `/$organizacaoHash/chat/$conversaId`.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { InboxOrgPage } from "@/components/inbox/inbox-org-page";
import { useOrganizacaoHash } from "@/lib/use-organizacao-hash";

export const Route = createFileRoute("/_panel/$organizacaoHash/chat/$conversaId")({
  component: ChatRoutePage,
});

function ChatRoutePage() {
  const navigate = useNavigate();
  const organizacaoHash = useOrganizacaoHash();
  const { conversaId } = Route.useParams();

  return (
    <InboxOrgPage
      selectedId={conversaId}
      onSelecionarConversa={(id) => {
        if (!organizacaoHash) return;
        if (id === conversaId) return;
        void navigate({
          to: "/$organizacaoHash/chat/$conversaId",
          params: { organizacaoHash, conversaId: id },
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
    />
  );
}
