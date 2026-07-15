import { useQuery } from "@tanstack/react-query";
import { mvpDefaults } from "@whasap/config";
import { Button } from "@whasap/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@whasap/ui/components/card";
import { Input } from "@whasap/ui/components/input";
import { Gift, Link2 } from "lucide-react";
import { toast } from "sonner";

import { orgInput } from "@/lib/org-input";
import { orpc } from "@/lib/orpc";
import { SITE_URL } from "@/lib/site-url";
import { useOrganizacaoHash } from "@/lib/use-organizacao-hash";

const { referral } = mvpDefaults.billing;

/** Seção Indique e Ganhe do modal de Ajustes — link de indicação (admin). */
export function SecaoAjustesIndique() {
  const organizacaoHash = useOrganizacaoHash();

  const org = useQuery(
    orpc.organizacao.obter.queryOptions({
      input: orgInput(organizacaoHash),
    }),
  );

  if (!organizacaoHash) return null;

  const isAdmin = org.data?.meuPapel === "admin";
  const linkIndicacao = `${SITE_URL.replace(/\/$/, "")}/indique?ref=${encodeURIComponent(organizacaoHash)}`;

  const copiarLinkIndicacao = async () => {
    try {
      await navigator.clipboard.writeText(linkIndicacao);
      toast.success("Link de indicação copiado");
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  };

  return (
    <div className="w-full space-y-6 p-6">
      <div>
        <h2 className="text-lg font-semibold">Indique e Ganhe</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Compartilhe seu link para indicar colegas ou clientes. Quem você indica ganha{" "}
          {referral.indicadoDescontoPercent}% no primeiro mês; você recebe{" "}
          {referral.indicadorMesGratis} mês grátis quando a indicação for elegível. Recompensas são
          aplicadas pela equipe comercial.
        </p>
      </div>

      {!isAdmin ? (
        <p className="text-sm text-muted-foreground">
          Apenas administradores podem gerar o link de indicação da organização.
        </p>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Gift className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base">Seu link de indicação</CardTitle>
                <CardDescription>
                  Quem acessar este link terá sua organização registrada como indicadora.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input readOnly value={linkIndicacao} className="font-mono text-xs sm:text-sm" />
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                onClick={() => void copiarLinkIndicacao()}
              >
                <Link2 className="mr-2 h-4 w-4" />
                Copiar link
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
