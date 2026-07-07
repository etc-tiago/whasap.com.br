import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { skipToken, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@whasap/ui/components/button";
import { Checkbox } from "@whasap/ui/components/checkbox";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@whasap/ui/components/input-otp";
import { Label } from "@whasap/ui/components/label";

import { EntradaShell } from "@/components/entrada-shell";
import { getOrpcErrorMessage } from "@/lib/orpc-error";
import { orpc } from "@/lib/orpc";

const OTP_DIGIT_SLOTS = [0, 1, 2, 3, 4, 5] as const;

export const Route = createFileRoute("/~/email/$emailHash")({
  component: EntradaCadastroPage,
});

function EntradaCadastroPage() {
  const { emailHash } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [otpEnviado, setOtpEnviado] = useState(false);
  const [otp, setOtp] = useState("");
  const [lgpdConsent, setLgpdConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fluxo = useQuery(
    orpc.autenticacao.obterFluxo.queryOptions({
      input: emailHash ? { hash: emailHash } : skipToken,
    }),
  );

  const enviarOtp = useMutation(orpc.autenticacao.enviarOtpFluxo.mutationOptions());
  const cadastrar = useMutation(orpc.autenticacao.cadastrarFluxo.mutationOptions());

  useEffect(() => {
    if (fluxo.isError) {
      void navigate({ to: "/~", replace: true });
      return;
    }
    if (fluxo.data?.tipo === "entrar") {
      void navigate({ to: "/~/$hash", params: { hash: emailHash }, replace: true });
      return;
    }
    if (fluxo.data?.bloqueado) {
      void navigate({ to: "/~/email/$emailHash/bloqueado", params: { emailHash } });
    }
  }, [fluxo.data, fluxo.isError, navigate]);

  async function handleCriarConta() {
    if (!lgpdConsent) {
      setError("É necessário aceitar os termos e a política de privacidade.");
      return;
    }

    setError(null);
    try {
      const result = await enviarOtp.mutateAsync({ hash: emailHash });
      if (result.bloqueado) {
        await navigate({ to: "/~/email/$emailHash/bloqueado", params: { emailHash } });
        return;
      }
      setOtpEnviado(true);
    } catch (err) {
      setError(getOrpcErrorMessage(err, "Não foi possível enviar o código."));
    }
  }

  async function handleConfirmarCadastro() {
    if (!lgpdConsent) {
      setError("É necessário aceitar os termos e a política de privacidade.");
      return;
    }

    setError(null);
    try {
      await cadastrar.mutateAsync({
        hash: emailHash,
        otp,
        lgpdConsent: true,
      });
      await queryClient.invalidateQueries({ queryKey: orpc.autenticacao.eu.key() });
      await navigate({ to: "/integracao" });
    } catch (err) {
      const message = getOrpcErrorMessage(err, "Não foi possível concluir o cadastro.");
      setError(message);
      if (message.toLowerCase().includes("contato")) {
        await navigate({ to: "/~/email/$emailHash/bloqueado", params: { emailHash } });
      }
    }
  }

  const emailLabel = fluxo.data?.emailMascarado ?? "seu e-mail";
  const nomeSugerido = fluxo.data?.nomeSugerido ?? "";

  return (
    <EntradaShell
      title="Criar conta"
      description={
        otpEnviado
          ? `Digite o código enviado para ${emailLabel}.`
          : `O e-mail ${emailLabel} ainda não tem conta no Whasap.`
      }
    >
      <div className="space-y-4">
        {!otpEnviado ? (
          <>
            <p className="text-sm text-muted-foreground">
              Vamos criar sua conta com o nome <strong>{nomeSugerido}</strong> (parte antes do @ do
              e-mail).
            </p>
            <div className="flex items-start gap-2">
              <Checkbox
                id="lgpd"
                checked={lgpdConsent}
                onCheckedChange={(v) => setLgpdConsent(v === true)}
              />
              <Label htmlFor="lgpd" className="text-sm font-normal leading-snug">
                Li e aceito os Termos de Uso e a Política de Privacidade (LGPD).
              </Label>
            </div>
            <Button
              className="w-full"
              onClick={() => void handleCriarConta()}
              disabled={!lgpdConsent || enviarOtp.isPending}
            >
              Criar conta
            </Button>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Código OTP</Label>
              <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                <InputOTPGroup>
                  {OTP_DIGIT_SLOTS.map((index) => (
                    <InputOTPSlot key={index} index={index} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button
              className="w-full"
              onClick={() => void handleConfirmarCadastro()}
              disabled={otp.length < 6 || cadastrar.isPending}
            >
              Confirmar cadastro
            </Button>
          </>
        )}
        <Button asChild variant="outline" className="w-full">
          <Link to="/~">Voltar ao início</Link>
        </Button>
        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-center text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </EntradaShell>
  );
}
