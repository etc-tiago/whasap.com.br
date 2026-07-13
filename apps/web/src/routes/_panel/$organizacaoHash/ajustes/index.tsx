import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@whasap/ui/components/card";

import { orgInput } from "@/lib/org-input";
import { orpc } from "@/lib/orpc";
import { useOrganizacaoHash } from "@/lib/use-organizacao-hash";

export const Route = createFileRoute("/_panel/$organizacaoHash/ajustes/")({
  component: AjustesIndexPage,
});

function formatarData(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function AjustesIndexPage() {
  const organizacaoHash = useOrganizacaoHash();

  const org = useQuery(
    orpc.organizacao.obter.queryOptions({
      input: orgInput(organizacaoHash),
    }),
  );

  const aceiteEm = formatarData(org.data?.aceiteAdesaoEm);

  return (
    <div className="max-w-lg space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organização</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Nome:</span> {org.data?.nome}
          </p>
          <p>
            <span className="text-muted-foreground">Papel:</span> {org.data?.meuPapel}
          </p>
          {org.data?.razaoSocial && (
            <p>
              <span className="text-muted-foreground">Razão social:</span> {org.data.razaoSocial}
            </p>
          )}
          {org.data?.documento && (
            <p>
              <span className="text-muted-foreground">CNPJ:</span> {org.data.documento}
            </p>
          )}
          {org.data?.telefoneWhatsapp && (
            <p>
              <span className="text-muted-foreground">WhatsApp:</span> {org.data.telefoneWhatsapp}
            </p>
          )}
          {aceiteEm && (
            <p>
              <span className="text-muted-foreground">Termo de adesão:</span> aceito em {aceiteEm}
              {org.data?.aceiteAdesaoVersao ? ` (versão ${org.data.aceiteAdesaoVersao})` : null}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
