export type EntradaStep = "email" | "terms" | "otp" | "verifying";

export type EntradaWizardState = {
  step: EntradaStep;
  email: string;
  emailMascarado: string;
  hash: string;
  isNewAccount: boolean;
  lgpdConsent: boolean;
};

export const entradaInitialState: EntradaWizardState = {
  step: "email",
  email: "",
  emailMascarado: "",
  hash: "",
  isNewAccount: false,
  lgpdConsent: false,
};

export type EntradaAction =
  | {
      type: "fluxo_iniciado";
      email: string;
      hash: string;
      tipo: "entrar" | "cadastrar";
      emailMascarado?: string;
    }
  | { type: "terms_accepted" }
  | { type: "terms_recusado" }
  | { type: "otp_verified" }
  | { type: "back" }
  | { type: "reset" };

export function entradaReducer(
  state: EntradaWizardState,
  action: EntradaAction,
): EntradaWizardState {
  switch (action.type) {
    case "fluxo_iniciado":
      return {
        ...state,
        email: action.email,
        emailMascarado: action.emailMascarado ?? action.email,
        hash: action.hash,
        isNewAccount: action.tipo === "cadastrar",
        step: action.tipo === "cadastrar" ? "terms" : "otp",
        lgpdConsent: false,
      };
    case "terms_accepted":
      return { ...state, step: "otp", lgpdConsent: true };
    case "terms_recusado":
      return { ...entradaInitialState };
    case "otp_verified":
      return { ...state, step: "verifying" };
    case "back": {
      if (state.step === "terms") return { ...state, step: "email" };
      if (state.step === "otp") {
        return { ...state, step: state.isNewAccount ? "terms" : "email" };
      }
      return state;
    }
    case "reset":
      return entradaInitialState;
    default:
      return state;
  }
}

export function entradaProgressIndex(step: EntradaStep): number {
  switch (step) {
    case "email":
      return 0;
    case "terms":
      return 1;
    case "otp":
      return 2;
    case "verifying":
      return 3;
  }
}
