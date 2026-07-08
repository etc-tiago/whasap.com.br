import { ShieldCheck, ArrowLeft } from "lucide-react";

import { SITE_URL } from "@/lib/site-url";

type Props = {
  email: string;
  onAccepted: () => void;
  onBack: () => void;
};

export function EntradaStepTermos({ email, onAccepted, onBack }: Props) {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-wa-green/15">
          <ShieldCheck className="h-6 w-6 text-wa-green-dark" />
        </div>
        <h1 className="text-2xl font-semibold text-wa-text">Criar sua conta</h1>
        <p className="text-sm text-wa-muted">
          Não encontramos uma conta para{" "}
          <strong className="text-wa-text">{email}</strong>. Aceite os termos para criarmos uma
          nova.
        </p>
      </div>

      <div className="max-h-40 space-y-2 overflow-y-auto rounded-xl border border-wa-border p-4 text-xs leading-relaxed text-wa-muted">
        <p>
          <strong className="text-wa-text">Termos de uso.</strong> Ao criar sua conta você concorda
          em usar a plataforma de forma responsável, respeitando as políticas da Meta e as leis
          aplicáveis.
        </p>
        <p>
          <strong className="text-wa-text">Privacidade.</strong> Coletamos apenas os dados
          necessários para operar o serviço. Você pode solicitar exclusão a qualquer momento.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center gap-1 rounded-xl border border-wa-border px-4 py-3 text-sm font-medium text-wa-text transition hover:bg-black/5"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onAccepted}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-wa-green px-4 py-3 text-sm font-semibold text-white transition hover:bg-wa-green-dark"
        >
          Aceitar e continuar
        </button>
      </div>

      <p className="text-center text-[11px] text-wa-muted">
        <a
          href={`${SITE_URL}/legal#termos`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-wa-green-dark underline"
        >
          Termos
        </a>{" "}
        ·{" "}
        <a
          href={`${SITE_URL}/legal#privacidade`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-wa-green-dark underline"
        >
          Política de Privacidade
        </a>
      </p>
    </div>
  );
}
