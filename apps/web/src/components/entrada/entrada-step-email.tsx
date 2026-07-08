import { useState } from "react";
import { Mail, Loader2, ArrowRight } from "lucide-react";

function isEmailValid(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) && value.length <= 255;
}

type Props = {
  onDone: (email: string) => void;
  loading?: boolean;
  error?: string | null;
};

export function EntradaStepEmail({ onDone, loading, error: externalError }: Props) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isEmailValid(email)) {
      setError("Digite um e-mail válido");
      return;
    }
    setError(null);
    onDone(email.trim().toLowerCase());
  }

  const displayError = externalError ?? error;

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold text-wa-text">Digite seu e-mail</h1>
        <p className="text-sm text-wa-muted">
          Vamos verificar se você já tem uma conta e enviar um código de acesso.
        </p>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-wa-muted">E-MAIL</span>
        <div className="flex items-center gap-2 rounded-xl border border-wa-border bg-wa-surface px-3 py-3 transition focus-within:border-wa-green focus-within:ring-2 focus-within:ring-wa-green/25">
          <Mail className="h-4 w-4 text-wa-muted" />
          <input
            type="email"
            autoFocus
            placeholder="voce@empresa.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 bg-transparent text-sm text-wa-text outline-none placeholder:text-wa-muted"
            disabled={loading}
          />
        </div>
        {displayError && <p className="mt-2 text-xs text-destructive">{displayError}</p>}
      </label>

      <button
        type="submit"
        disabled={loading || !email}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-wa-green px-4 py-3 text-sm font-semibold text-white transition hover:bg-wa-green-dark disabled:opacity-60"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Verificando...
          </>
        ) : (
          <>
            Continuar <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
    </form>
  );
}
