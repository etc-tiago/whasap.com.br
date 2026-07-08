import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ArrowLeft, RefreshCw } from "lucide-react";

import { EntradaOtpDigits } from "@/components/entrada/entrada-otp-digits";
import { sincronizarSessaoPosAuth } from "@/lib/auth";
import { orpc } from "@/lib/orpc";
import { getOrpcErrorMessage } from "@/lib/orpc-error";

const RESEND_SECONDS = 30;

type Props = {
  hash: string;
  emailLabel: string;
  isNewAccount: boolean;
  lgpdConsent: boolean;
  onVerified: () => void;
  onBack: () => void;
  onBlocked: (hash: string) => void;
};

export function EntradaStepOtp({
  hash,
  emailLabel,
  isNewAccount,
  lgpdConsent,
  onVerified,
  onBack,
  onBlocked,
}: Props) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const enviadoRef = useRef(false);

  const enviarOtp = useMutation(orpc.autenticacao.enviarOtpFluxo.mutationOptions());
  const entrar = useMutation(orpc.autenticacao.entrarFluxo.mutationOptions());
  const cadastrar = useMutation(orpc.autenticacao.cadastrarFluxo.mutationOptions());

  const loading = entrar.isPending || cadastrar.isPending;

  useEffect(() => {
    setCode("");
    setError(null);
    setSeconds(RESEND_SECONDS);
    enviadoRef.current = false;
  }, [hash]);

  useEffect(() => {
    if (!hash || enviadoRef.current) return;
    enviadoRef.current = true;
    enviarOtp.mutate(
      { hash },
      {
        onSuccess: (result) => {
          if (result.bloqueado) onBlocked(hash);
        },
        onError: (err) => {
          setError(getOrpcErrorMessage(err, "Não foi possível enviar o código."));
        },
      },
    );
  }, [hash, enviarOtp, onBlocked]);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  async function submit() {
    if (code.length !== 6 || loading) return;
    if (isNewAccount && !lgpdConsent) {
      setError("É necessário aceitar os termos.");
      return;
    }
    setError(null);
    try {
      await (isNewAccount
        ? cadastrar.mutateAsync({ hash, otp: code, lgpdConsent: true })
        : entrar.mutateAsync({ hash, otp: code }));

      await sincronizarSessaoPosAuth(queryClient);
      onVerified();
    } catch (err) {
      const message = getOrpcErrorMessage(err, "Código inválido ou expirado.");
      setError(message);
      if (message.toLowerCase().includes("bloqueado") || message.toLowerCase().includes("contato")) {
        onBlocked(hash);
      }
    }
  }

  async function resend() {
    setError(null);
    try {
      const result = await enviarOtp.mutateAsync({ hash });
      if (result.bloqueado) {
        onBlocked(hash);
        return;
      }
      setSeconds(RESEND_SECONDS);
      setCode("");
    } catch (err) {
      setError(getOrpcErrorMessage(err, "Não foi possível reenviar o código."));
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold text-wa-text">Verifique seu e-mail</h1>
        <p className="text-sm text-wa-muted">
          Enviamos um código de 6 dígitos para{" "}
          <strong className="text-wa-text">{emailLabel}</strong>.
        </p>
      </div>

      <EntradaOtpDigits value={code} onChange={setCode} disabled={loading} />

      {error && <p className="text-center text-xs text-destructive">{error}</p>}

      <div className="text-center text-xs text-wa-muted">
        {seconds > 0 ? (
          <span>Reenviar código em {seconds}s</span>
        ) : (
          <button
            type="button"
            onClick={() => void resend()}
            disabled={enviarOtp.isPending}
            className="inline-flex items-center gap-1 font-medium text-wa-green-dark hover:underline"
          >
            <RefreshCw className={`h-3 w-3 ${enviarOtp.isPending ? "animate-spin" : ""}`} />
            Reenviar código
          </button>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className="flex items-center justify-center gap-1 rounded-xl border border-wa-border px-4 py-3 text-sm font-medium text-wa-text transition hover:bg-black/5 disabled:opacity-60"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={code.length !== 6 || loading}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-wa-green px-4 py-3 text-sm font-semibold text-white transition hover:bg-wa-green-dark disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Verificando...
            </>
          ) : (
            "Verificar e entrar"
          )}
        </button>
      </div>
    </div>
  );
}
