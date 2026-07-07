import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { skipToken, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Button } from "@whasap/ui/components/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@whasap/ui/components/input-otp";
import { Label } from "@whasap/ui/components/label";

import { EntradaShell } from "@/components/entrada-shell";
import { getOrpcErrorMessage } from "@/lib/orpc-error";
import { orpc } from "@/lib/orpc";

const OTP_DIGIT_SLOTS = [0, 1, 2, 3, 4, 5] as const;

export const Route = createFileRoute("/~/$hash")({
  component: EntradaLoginPage,
});

function EntradaLoginPage() {
  const { hash } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const otpEnviadoRef = useRef(false);

  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fluxo = useQuery(
    orpc.autenticacao.obterFluxo.queryOptions({
      input: hash ? { hash } : skipToken,
    }),
  );

  const enviarOtp = useMutation(orpc.autenticacao.enviarOtpFluxo.mutationOptions());
  const entrar = useMutation(orpc.autenticacao.entrarFluxo.mutationOptions());

  useEffect(() => {
    if (!hash || otpEnviadoRef.current || fluxo.isLoading || fluxo.isError) return;
    if (fluxo.data?.tipo === "cadastrar") {
      void navigate({ to: "/~/email/$emailHash", params: { emailHash: hash }, replace: true });
      return;
    }
    if (fluxo.data?.bloqueado) {
      void navigate({ to: "/~/email/$emailHash/bloqueado", params: { emailHash: hash } });
      return;
    }
    if (fluxo.data?.tipo !== "entrar") return;

    otpEnviadoRef.current = true;
    enviarOtp.mutate(
      { hash },
      {
        onError: (err) => {
          setError(getOrpcErrorMessage(err, "Não foi possível enviar o código."));
          otpEnviadoRef.current = false;
        },
      },
    );
  }, [hash, fluxo.data, fluxo.isLoading, fluxo.isError, enviarOtp, navigate]);

  useEffect(() => {
    if (fluxo.isError) {
      void navigate({ to: "/~", replace: true });
    }
  }, [fluxo.isError, navigate]);

  async function handleEntrar() {
    setError(null);
    try {
      await entrar.mutateAsync({ hash, otp });
      await queryClient.invalidateQueries({ queryKey: orpc.autenticacao.eu.key() });
      await navigate({ to: "/" });
    } catch (err) {
      setError(getOrpcErrorMessage(err, "Código inválido ou expirado."));
    }
  }

  const emailLabel = fluxo.data?.emailMascarado ?? "seu e-mail";

  return (
    <EntradaShell description={`Enviamos um código para ${emailLabel}.`}>
      <div className="space-y-4">
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
          onClick={() => void handleEntrar()}
          disabled={otp.length < 6 || entrar.isPending}
        >
          Entrar
        </Button>
        <Button asChild variant="outline" className="w-full">
          <Link to="/~">Voltar ao início</Link>
        </Button>
        {enviarOtp.isPending && (
          <p className="text-center text-sm text-muted-foreground">Enviando código...</p>
        )}
        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-center text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </EntradaShell>
  );
}
