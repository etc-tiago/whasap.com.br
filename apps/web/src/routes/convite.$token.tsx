import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@whasap/ui/components/button";
import { Input } from "@whasap/ui/components/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@whasap/ui/components/input-otp";
import { Label } from "@whasap/ui/components/label";

import { getOrpcErrorMessage } from "@/lib/orpc-error";
import { orpc } from "@/lib/orpc";

export const Route = createFileRoute("/convite/$token")({
  component: ConvitePage,
});

function ConvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendOtp = useMutation(orpc.autenticacao.enviarOtp.mutationOptions());
  const aceitar = useMutation(orpc.organizacao.convites.aceitar.mutationOptions());

  async function handleSendOtp() {
    if (!email) return;
    setError(null);
    try {
      await sendOtp.mutateAsync({
        email,
        proposito: "convite",
      });
      setOtpSent(true);
    } catch (err) {
      setError(getOrpcErrorMessage(err, "Não foi possível enviar o código."));
    }
  }

  async function handleAceitar() {
    if (otp.length !== 6) return;
    setError(null);
    try {
      const result = await aceitar.mutateAsync({ token, otp });
      navigate({
        to: "/$organizacaoHash",
        params: { organizacaoHash: result.organizacaoHash },
      });
    } catch (err) {
      setError(getOrpcErrorMessage(err, "Não foi possível aceitar o convite."));
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6 rounded-xl border bg-card p-6 shadow-sm">
        <div className="text-center">
          <h1 className="text-xl font-semibold">Aceitar convite</h1>
          <p className="text-sm text-muted-foreground">
            Use o email que recebeu o convite
          </p>
        </div>

        {!otpSent ? (
          <>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              disabled={sendOtp.isPending || !email}
              onClick={handleSendOtp}
            >
              Enviar código
            </Button>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Código OTP</Label>
              <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button
              className="w-full"
              disabled={aceitar.isPending || otp.length !== 6}
              onClick={handleAceitar}
            >
              Entrar na organização
            </Button>
          </>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}
