import { createContext, useContext } from "react";

type WaMenuNavegacaoContextValue = {
  abrir: () => void;
};

const WaMenuNavegacaoContext = createContext<WaMenuNavegacaoContextValue | null>(null);

export function WaMenuNavegacaoProvider({
  value,
  children,
}: {
  value: WaMenuNavegacaoContextValue;
  children: React.ReactNode;
}) {
  return (
    <WaMenuNavegacaoContext.Provider value={value}>{children}</WaMenuNavegacaoContext.Provider>
  );
}

/** Abre o menu de navegação (rail) no mobile. Null fora do shell da org. */
export function useWaMenuNavegacao(): WaMenuNavegacaoContextValue | null {
  return useContext(WaMenuNavegacaoContext);
}
