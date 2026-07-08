import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useReducer, useState } from "react";

import { WaBackdrop } from "@/components/wa-backdrop";
import { EntradaStepEmail } from "@/components/entrada/entrada-step-email";
import { EntradaStepOtp } from "@/components/entrada/entrada-step-otp";
import { EntradaStepTermos } from "@/components/entrada/entrada-step-termos";
import { EntradaStepVerificando } from "@/components/entrada/entrada-step-verificando";
import { EntradaWizardShell } from "@/components/entrada/entrada-wizard-shell";
import {
  entradaInitialState,
  entradaProgressIndex,
  entradaReducer,
} from "@/lib/entrada/wizard-state";
import { orpc } from "@/lib/orpc";
import { getOrpcErrorMessage } from "@/lib/orpc-error";

export const Route = createFileRoute("/~/")({
  head: () => ({
    meta: [
      { title: "Entrar — Whasap" },
      {
        name: "description",
        content: "Entre ou crie sua conta no Whasap com verificação por e-mail.",
      },
    ],
  }),
  component: EntradaWizardPage,
});

function EntradaWizardPage() {
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(entradaReducer, entradaInitialState);
  const [emailError, setEmailError] = useState<string | null>(null);

  const iniciar = useMutation(orpc.autenticacao.iniciarFluxo.mutationOptions());

  const handleBlocked = useCallback(
    (hash: string) => {
      void navigate({
        to: "/~/email/$emailHash/bloqueado",
        params: { emailHash: hash },
      });
    },
    [navigate],
  );

  const handleVerificandoDone = useCallback(
    (hasOrg: boolean) => {
      void navigate({ to: hasOrg ? "/" : "/integracao", replace: true });
    },
    [navigate],
  );

  async function handleEmailSubmit(email: string) {
    setEmailError(null);
    try {
      const result = await iniciar.mutateAsync({ email });
      dispatch({
        type: "fluxo_iniciado",
        email,
        hash: result.hash,
        tipo: result.tipo,
      });
    } catch (err) {
      setEmailError(getOrpcErrorMessage(err, "Não foi possível continuar. Tente novamente."));
    }
  }

  return (
    <>
      <WaBackdrop />
      <EntradaWizardShell
        step={state.step}
        progress={{ current: entradaProgressIndex(state.step), total: 4 }}
      >
        {state.step === "email" && (
          <EntradaStepEmail
            onDone={(email) => void handleEmailSubmit(email)}
            loading={iniciar.isPending}
            error={emailError}
          />
        )}

        {state.step === "terms" && (
          <EntradaStepTermos
            email={state.email}
            onAccepted={() => dispatch({ type: "terms_accepted" })}
            onBack={() => dispatch({ type: "terms_recusado" })}
          />
        )}

        {state.step === "otp" && state.hash && (
          <EntradaStepOtp
            hash={state.hash}
            emailLabel={state.emailMascarado || state.email}
            isNewAccount={state.isNewAccount}
            lgpdConsent={state.lgpdConsent}
            onVerified={() => dispatch({ type: "otp_verified" })}
            onBack={() => dispatch({ type: "back" })}
            onBlocked={handleBlocked}
          />
        )}

        {state.step === "verifying" && (
          <EntradaStepVerificando onDone={handleVerificandoDone} />
        )}
      </EntradaWizardShell>
    </>
  );
}
