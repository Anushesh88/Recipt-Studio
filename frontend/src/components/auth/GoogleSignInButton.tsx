import React, { useEffect, useRef, useState } from "react";
import { apiClient, apiErrorMessage } from "../../api/client";
import { useAuthStore } from "../../store/authStore";
import { useAuthProviders } from "../../api/auth";

// "Sign in with Google" via Google Identity Services: Google's own button
// returns an ID token ("credential"), which POST /auth/google checks and trades
// for our login token. Shown only when the backend has a GOOGLE_CLIENT_ID.

interface GoogleIdentity {
  accounts: {
    id: {
      initialize(options: { client_id: string; callback: (response: { credential: string }) => void; ux_mode?: "popup" | "redirect" }): void;
      renderButton(parent: HTMLElement, options: Record<string, string | number>): void;
    };
  };
}
declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

const GIS_SCRIPT = "https://accounts.google.com/gsi/client";
// Google's button takes a width between 200 and 400px
const BUTTON_WIDTH = { min: 200, max: 400 };

let gisScript: Promise<GoogleIdentity> | null = null;
function loadGoogleIdentity(): Promise<GoogleIdentity> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  gisScript ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GIS_SCRIPT;
    script.async = true;
    script.onload = () => (window.google ? resolve(window.google) : reject(new Error("Google Identity Services didn't load")));
    script.onerror = () => {
      gisScript = null; // let a later visit try again
      reject(new Error("Google Identity Services didn't load"));
    };
    document.head.appendChild(script);
  });
  return gisScript;
}

export const GoogleSignInButton: React.FC<{ signUp: boolean }> = ({ signUp }) => {
  const clientId = useAuthProviders().data?.google_client_id;
  const setToken = useAuthStore((state) => state.setToken);
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    loadGoogleIdentity()
      .then((google) => {
        const parent = container.current;
        if (cancelled || !parent) return;
        google.accounts.id.initialize({
          client_id: clientId,
          ux_mode: "popup",
          callback: async ({ credential }) => {
            setError(null);
            try {
              const res = await apiClient.post<{ access_token: string }>("/auth/google", { credential });
              setToken(res.data.access_token);
            } catch (e) {
              setError(apiErrorMessage(e, "Google sign-in failed. Please try again."));
            }
          },
        });
        const width = Math.round(Math.min(BUTTON_WIDTH.max, Math.max(BUTTON_WIDTH.min, parent.offsetWidth)));
        google.accounts.id.renderButton(parent, {
          type: "standard", theme: "outline", size: "large", shape: "rectangular", logo_alignment: "center",
          text: signUp ? "signup_with" : "signin_with", width,
        });
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load Google sign-in. Check your connection and try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, signUp, setToken]);

  if (!clientId) return null;
  return (
    <div className="space-y-4" data-google-sign-in="">
      <div ref={container} className="flex min-h-10 justify-center" />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        or with email
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
};
