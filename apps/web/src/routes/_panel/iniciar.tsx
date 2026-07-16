/**
 * Deep-link para iniciar conversa: `/iniciar?phone=55…&mensagem=…`
 * Resolve a organização operacional e redireciona para a inbox com o formulário pré-preenchido.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { useSession } from "@/lib/auth";
import { eSessaoNaoAutorizada } from "@/lib/orpc-error";
import { orpc } from "@/lib/orpc";
import { buscarDestinoInboxOperacional } from "@/lib/resolver-destino-painel";
import { normalizarTelefoneBr } from "@/lib/telefone-br";

type IniciarSearch = {
  phone?: string;
  /** Alias pt-BR de `phone`. */
  telefone?: string;
  mensagem?: string;
  /** Alias EN de `mensagem`. */
  text?: string;
  instancia?: string;
  nome?: string;
};

export const Route = createFileRoute("/_panel/iniciar")({
  validateSearch: (s: Record<string, unknown>): IniciarSearch => ({
    phone: typeof s.phone === "string" && s.phone ? s.phone : undefined,
    telefone: typeof s.telefone === "string" && s.telefone ? s.telefone : undefined,
    mensagem: typeof s.mensagem === "string" && s.mensagem ? s.mensagem : undefined,
    text: typeof s.text === "string" && s.text ? s.text : undefined,
    instancia: typeof s.instancia === "string" && s.instancia ? s.instancia : undefined,
    nome: typeof s.nome === "string" && s.nome ? s.nome : undefined,
  }),
  component: IniciarPage,
});

function IniciarPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { data: session, isPending, isError, error } = useSession();
  const semSessao = (!isPending && !session?.usuario) || (isError && eSessaoNaoAutorizada(error));
  const orgs = useQuery({
    ...orpc.organizacao.lista.queryOptions(),
    enabled: Boolean(session?.usuario) && !semSessao,
  });

  useEffect(() => {
    if (semSessao) {
      void navigate({ to: "/~", replace: true });
      return;
    }
    if (isPending) return;
    if (!session?.usuario) return;
    if (!orgs.isSuccess) return;

    if (orgs.data.length === 0) {
      void navigate({ to: "/integracao", replace: true });
      return;
    }

    const telefoneBruto = search.phone ?? search.telefone;
    const telefone = telefoneBruto ? normalizarTelefoneBr(telefoneBruto) : undefined;
    const mensagem = search.mensagem ?? search.text;

    let cancelled = false;

    void (async () => {
      const destino = await buscarDestinoInboxOperacional(orgs.data);
      if (cancelled) return;

      const organizacaoHash = destino?.organizacaoHash ?? orgs.data[0]!.id;

      if (!telefone) {
        void navigate({
          to: "/$organizacaoHash/inbox",
          params: { organizacaoHash },
          replace: true,
        });
        return;
      }

      void navigate({
        to: "/$organizacaoHash/inbox",
        params: { organizacaoHash },
        search: {
          telefone,
          ...(mensagem ? { mensagem } : {}),
          ...(search.instancia ? { instancia: search.instancia } : {}),
          ...(search.nome ? { nome: search.nome } : {}),
        },
        replace: true,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [
    semSessao,
    session?.usuario,
    isPending,
    orgs.isSuccess,
    orgs.data,
    navigate,
    search.phone,
    search.telefone,
    search.mensagem,
    search.text,
    search.instancia,
    search.nome,
  ]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
      Abrindo conversa…
    </div>
  );
}
