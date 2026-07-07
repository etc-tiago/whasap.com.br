import { skipToken, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@whasap/ui/components/button";
import { Checkbox } from "@whasap/ui/components/checkbox";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@whasap/ui/components/input-otp";
import { Label } from "@whasap/ui/components/label";
import { useEffect, useState } from "react";

import { EntradaShell } from "@/components/entrada-shell";
import { orpc } from "@/lib/orpc";
import { getOrpcErrorMessage } from "@/lib/orpc-error";
import { SITE_URL } from "@/lib/site-url";

const OTP_DIGIT_SLOTS = [0, 1, 2, 3, 4, 5] as const;

export const Route = createFileRoute("/~/email/$emailHash/")({
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
    setOtpEnviado(false);
    setOtp("");
    setLgpdConsent(false);
    setError(null);
    void queryClient.removeQueries({
      queryKey: orpc.autenticacao.obterFluxo.key({ input: { hash: emailHash } }),
    });
  }, [emailHash, queryClient]);

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
  }, [fluxo.data, fluxo.isError, navigate, emailHash]);

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
            <div className="flex items-start gap-2">
              <Checkbox
                id="lgpd"
                checked={lgpdConsent}
                onCheckedChange={(v) => setLgpdConsent(v === true)}
              />
              <Label htmlFor="lgpd" className="text-sm font-normal leading-snug">
                Li e aceito os{" "}
                <a
                  href={`${SITE_URL}/legal#termos`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  Termos de Uso
                </a>{" "}
                e a{" "}
                <a
                  href={`${SITE_URL}/legal#privacidade`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  Política de Privacidade
                </a>{" "}
                (LGPD).
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
