import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { cnpjValido, telefoneWhatsappBrValido } from "@whasap/config";
import { Button } from "@whasap/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@whasap/ui/components/card";
import { Checkbox } from "@whasap/ui/components/checkbox";
import { Input } from "@whasap/ui/components/input";
import { Label } from "@whasap/ui/components/label";

import { WaBackdrop } from "@/components/wa-backdrop";
import { orpc } from "@/lib/orpc";

const TERMO_ADESAO_URL = "https://whasap.com.br/legal#adesao";

export const Route = createFileRoute("/_panel/integracao")({
  component: IntegracaoPage,
});

function IntegracaoPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [nome, setNome] = useState("");
  const [documento, setDocumento] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [telefoneWhatsapp, setTelefoneWhatsapp] = useState("");
  const [aceiteAdesao, setAceiteAdesao] = useState(false);
  const criar = useMutation(orpc.organizacao.criar.mutationOptions());

  const formValido =
    nome.trim().length >= 2 &&
    cnpjValido(documento) &&
    razaoSocial.trim().length >= 2 &&
    telefoneWhatsappBrValido(telefoneWhatsapp) &&
    aceiteAdesao;

  async function handleCriar() {
    if (!formValido || !aceiteAdesao) return;
    const org = await criar.mutateAsync({
      nome: nome.trim(),
      documento,
      tipoDocumento: "cnpj",
      razaoSocial: razaoSocial.trim(),
      telefoneWhatsapp,
      aceiteAdesao: true,
    });
    await queryClient.invalidateQueries({ queryKey: orpc.organizacao.lista.key() });
    navigate({
      to: "/$organizacaoHash",
      params: { organizacaoHash: org.id },
    });
  }

  return (
    <>
      <WaBackdrop />
      <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Nova organização</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-nome">Nome da organização</Label>
              <Input
                id="org-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Minha empresa"
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
                placeholder="Empresa Ltda"
                autoComplete="organization"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-whatsapp">WhatsApp de contato</Label>
              <Input
                id="org-whatsapp"
                value={telefoneWhatsapp}
                onChange={(e) => setTelefoneWhatsapp(e.target.value)}
                placeholder="(11) 98888-7777"
                inputMode="tel"
                autoComplete="tel"
              />
              <p className="text-xs text-muted-foreground">
                Telefone para faturamento e suporte — não é o número da conexão WhatsApp.
              </p>
            </div>
            <label className="flex items-start gap-3 text-sm leading-snug">
              <Checkbox
                checked={aceiteAdesao}
                onCheckedChange={(v) => setAceiteAdesao(v === true)}
                className="mt-0.5"
              />
              <span>
                Li e aceito o{" "}
                <a
                  href={TERMO_ADESAO_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-foreground underline underline-offset-2"
                >
                  termo de adesão
                </a>
              </span>
            </label>
            <Button
              className="w-full"
              disabled={!formValido || criar.isPending}
              onClick={handleCriar}
            >
              Criar organização
            </Button>
            {criar.isError && (
              <p className="text-sm text-destructive">
                Não foi possível criar a organização. Verifique os dados e tente de novo.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
