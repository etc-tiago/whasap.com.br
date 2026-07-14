import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { cnpjValido } from "@whasap/config";
import { Button } from "@whasap/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@whasap/ui/components/card";
import { Input } from "@whasap/ui/components/input";
import { Label } from "@whasap/ui/components/label";
import { Link2 } from "lucide-react";

import { orgInput } from "@/lib/org-input";
import { orpc } from "@/lib/orpc";
import { getOrpcErrorMessage } from "@/lib/orpc-error";
import { SITE_URL } from "@/lib/site-url";
import { useOrganizacaoHash } from "@/lib/use-organizacao-hash";

/**
 * Bloco de ajustes da organização — nome, CNPJ e razão social.
 * Visível apenas para admin; dados e mutação independentes do restante da página.
 */
export function BlocoOrganizacao() {
  const queryClient = useQueryClient();
  const organizacaoHash = useOrganizacaoHash();

  const [nome, setNome] = useState("");
  const [documento, setDocumento] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [seedId, setSeedId] = useState<string | null>(null);

  const org = useQuery(
    orpc.organizacao.obter.queryOptions({
      input: orgInput(organizacaoHash),
    }),
  );

  useEffect(() => {
    if (!org.data || seedId === org.data.id) return;
    setNome(org.data.nome);
    setDocumento(org.data.documento ?? "");
    setRazaoSocial(org.data.razaoSocial ?? "");
    setSeedId(org.data.id);
  }, [org.data, seedId]);

  const atualizar = useMutation(
    orpc.organizacao.atualizar.mutationOptions({
      onSuccess: async (data) => {
        setNome(data.nome);
        setDocumento(data.documento ?? "");
        setRazaoSocial(data.razaoSocial ?? "");
        if (!organizacaoHash) return;
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: orpc.organizacao.obter.key({
              input: { organizacaoHash },
            }),
          }),
          queryClient.invalidateQueries({ queryKey: orpc.organizacao.lista.key() }),
          queryClient.invalidateQueries({ queryKey: orpc.autenticacao.eu.key() }),
        ]);
      },
    }),
  );

  if (!organizacaoHash) return null;
  if (org.isPending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organização</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Carregando…</p>
        </CardContent>
      </Card>
    );
  }

  if (org.data?.meuPapel !== "admin") return null;

  const nomeOk = nome.trim().length >= 2;
  const razaoOk = razaoSocial.trim().length >= 2;
  const cnpjOk = cnpjValido(documento);
  const alterado =
    nome.trim() !== (org.data.nome ?? "").trim() ||
    documento.replace(/\D/g, "") !== (org.data.documento ?? "").replace(/\D/g, "") ||
    razaoSocial.trim() !== (org.data.razaoSocial ?? "").trim();
  const podeSalvar = nomeOk && razaoOk && cnpjOk && alterado && !atualizar.isPending;

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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Organização</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="org-nome">Nome</Label>
          <Input
            id="org-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            autoComplete="organization"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="org-cnpj">CNPJ</Label>
          <Input
            id="org-cnpj"
            value={documento}
            onChange={(e) => setDocumento(e.target.value)}
            placeholder="00.000.000/0000-00"
            inputMode="numeric"
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="org-razao">Razão social</Label>
          <Input
            id="org-razao"
            value={razaoSocial}
            onChange={(e) => setRazaoSocial(e.target.value)}
            autoComplete="organization"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={!podeSalvar}
            onClick={() =>
              atualizar.mutate({
                organizacaoHash,
                nome: nome.trim(),
                documento,
                tipoDocumento: "cnpj",
                razaoSocial: razaoSocial.trim(),
              })
            }
          >
            {atualizar.isPending ? "Salvando…" : "Salvar"}
          </Button>
          <Button type="button" variant="outline" onClick={() => void copiarLinkIndicacao()}>
            <Link2 className="mr-2 h-4 w-4" />
            Gerar link de indicação
          </Button>
        </div>
        {atualizar.isError && (
          <p className="text-sm text-destructive">
            {getOrpcErrorMessage(atualizar.error, "Não foi possível salvar a organização.")}
          </p>
        )}
        {atualizar.isSuccess && !alterado && (
          <p className="text-sm text-muted-foreground">Alterações salvas.</p>
        )}
        <p className="text-xs text-muted-foreground">
          Indique e Ganhe: compartilhe o link para indicar colegas ou clientes. Recompensas são
          aplicadas pela equipe comercial.
        </p>
      </CardContent>
    </Card>
  );
}
