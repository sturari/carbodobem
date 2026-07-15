import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

const STORAGE_KEY = "cdb-cookie-consent";

type Consent = "accepted" | "rejected";

function applyConsent(consent: Consent) {
  // gtag Consent Mode v2. Só liberamos analytics/ads quando "accepted".
  const w = window as unknown as {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  };
  if (typeof w.gtag !== "function") {
    // Se gtag ainda não carregou, adiciona no dataLayer.
    w.dataLayer = w.dataLayer ?? [];
    w.dataLayer.push([
      "consent",
      "update",
      {
        ad_storage: consent === "accepted" ? "granted" : "denied",
        analytics_storage: consent === "accepted" ? "granted" : "denied",
        ad_user_data: consent === "accepted" ? "granted" : "denied",
        ad_personalization: consent === "accepted" ? "granted" : "denied",
      },
    ]);
    return;
  }
  w.gtag("consent", "update", {
    ad_storage: consent === "accepted" ? "granted" : "denied",
    analytics_storage: consent === "accepted" ? "granted" : "denied",
    ad_user_data: consent === "accepted" ? "granted" : "denied",
    ad_personalization: consent === "accepted" ? "granted" : "denied",
  });
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Consent | null;
      if (!saved) {
        setVisible(true);
      } else {
        applyConsent(saved);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  function decidir(consent: Consent) {
    try {
      localStorage.setItem(STORAGE_KEY, consent);
    } catch {
      /* ignore */
    }
    applyConsent(consent);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Aviso de cookies"
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-3xl rounded-2xl border border-border/70 bg-card p-4 shadow-2xl sm:inset-x-6 sm:bottom-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <p className="text-sm text-foreground">
          Usamos cookies essenciais para o funcionamento do site e cookies analíticos
          para entender como você usa nossa loja. Saiba mais na{" "}
          <Link to="/privacidade" className="font-semibold text-primary underline">
            Política de Privacidade
          </Link>
          .
        </p>
        <div className="flex flex-wrap justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={() => decidir("rejected")}
            className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Rejeitar
          </button>
          <button
            type="button"
            onClick={() => decidir("accepted")}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Aceitar todos
          </button>
        </div>
      </div>
    </div>
  );
}
