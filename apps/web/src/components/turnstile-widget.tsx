import { useEffect, useRef, useState } from "react";

import { getTurnstileSiteKey } from "@/lib/public-env";

const TURNSTILE_SCRIPT_ID = "cf-turnstile-script";
const TURNSTILE_SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
      theme?: "light" | "dark" | "auto";
    },
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();

  const existing = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Turnstile script failed")), {
        once: true,
      });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Turnstile script failed"));
    document.head.appendChild(script);
  });
}

type TurnstileWidgetProps = {
  onTokenChange: (token: string | null) => void;
  resetKey?: number;
};

export function TurnstileWidget({ onTokenChange, resetKey = 0 }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const siteKey = getTurnstileSiteKey();

  useEffect(() => {
    onTokenChange(null);
    if (!siteKey) {
      setLoadError("Turnstile não configurado (VITE_TURNSTILE_SITE_KEY).");
      return;
    }

    let cancelled = false;

    async function mount() {
      try {
        await loadTurnstileScript();
        if (cancelled || !containerRef.current || !window.turnstile) return;

        if (widgetIdRef.current) {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        }

        containerRef.current.innerHTML = "";
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: "auto",
          callback: (token) => onTokenChange(token),
          "expired-callback": () => onTokenChange(null),
          "error-callback": () => onTokenChange(null),
        });
        setLoadError(null);
      } catch {
        if (!cancelled) {
          setLoadError("Não foi possível carregar a verificação de segurança.");
        }
      }
    }

    mount();

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, resetKey, onTokenChange]);

  if (!siteKey) {
    return (
      <p className="text-center text-xs text-destructive">
        Turnstile não configurado. Defina VITE_TURNSTILE_SITE_KEY.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="flex justify-center" />
      {loadError && <p className="text-center text-xs text-destructive">{loadError}</p>}
    </div>
  );
}
