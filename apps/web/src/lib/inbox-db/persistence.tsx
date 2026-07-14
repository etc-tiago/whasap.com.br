/**
 * Persistência SQLite (OPFS) compartilhada das collections da inbox.
 * Se OPFS/WASM falhar, as collections rodam só em memória (Query Collection).
 */
import {
  BrowserCollectionCoordinator,
  createBrowserWASQLitePersistence,
  openBrowserWASQLiteOPFSDatabase,
  type PersistedCollectionPersistence,
} from "@tanstack/browser-db-sqlite-persistence";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type InboxDbState = {
  /** True após tentativa de abrir OPFS (sucesso ou fallback). */
  ready: boolean;
  persistence: PersistedCollectionPersistence | null;
  /** Incrementa a cada wipe (logout / sessão expirada) para recriar collections. */
  epoch: number;
};

const InboxDbContext = createContext<InboxDbState>({
  ready: false,
  persistence: null,
  epoch: 0,
});

const DB_NAME = "whasap-inbox";
const SQLITE_FILE = "whasap-inbox-v1.sqlite";

type WipeListener = () => void;
const wipeListeners = new Set<WipeListener>();

/**
 * Pede ao `InboxDbProvider` para fechar o SQLite, tentar remover o OPFS e reabrir limpo.
 * No-op se o provider ainda não montou.
 */
export async function solicitarWipePersistenciaSqliteInbox(): Promise<void> {
  const listeners = [...wipeListeners];
  await Promise.all(listeners.map((l) => Promise.resolve(l())));
}

async function tentarRemoverArquivoOpfs(): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.storage?.getDirectory) return;
  try {
    const root = await navigator.storage.getDirectory();
    await root.removeEntry(SQLITE_FILE, { recursive: true });
  } catch {
    // Arquivo inexistente ou OPFS indisponível — ok.
  }
}

/**
 * Abre SQLite OPFS uma vez e disponibiliza `persistence` para as collections.
 * Em falha (Safari privado, OPFS indisponível, etc.), `persistence` fica null.
 */
export function InboxDbProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<InboxDbState>({
    ready: typeof window === "undefined",
    persistence: null,
    epoch: 0,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    let disposed = false;
    let disposeAtual: (() => void) | undefined;
    let abrirSeq = 0;

    async function abrirPersistencia(epoch: number) {
      const seq = ++abrirSeq;
      disposeAtual?.();
      disposeAtual = undefined;

      try {
        const database = await openBrowserWASQLiteOPFSDatabase({
          databaseName: SQLITE_FILE,
        });
        const coordinator = new BrowserCollectionCoordinator({ dbName: DB_NAME });
        const persistence = createBrowserWASQLitePersistence({
          database,
          coordinator,
        });

        if (disposed || seq !== abrirSeq) {
          coordinator.dispose();
          await database.close?.();
          return;
        }

        disposeAtual = () => {
          coordinator.dispose();
          void database.close?.();
        };
        setState({ ready: true, persistence, epoch });
      } catch {
        if (!disposed && seq === abrirSeq) {
          setState({ ready: true, persistence: null, epoch });
        }
      }
    }

    void abrirPersistencia(0);

    const onWipe: WipeListener = () => {
      void (async () => {
        disposeAtual?.();
        disposeAtual = undefined;
        await tentarRemoverArquivoOpfs();
        if (disposed) return;
        setState((prev) => {
          const nextEpoch = prev.epoch + 1;
          void abrirPersistencia(nextEpoch);
          return { ready: false, persistence: null, epoch: nextEpoch };
        });
      })();
    };

    wipeListeners.add(onWipe);

    return () => {
      disposed = true;
      wipeListeners.delete(onWipe);
      disposeAtual?.();
    };
  }, []);

  return <InboxDbContext.Provider value={state}>{children}</InboxDbContext.Provider>;
}

export function useInboxDb(): InboxDbState {
  return useContext(InboxDbContext);
}
