import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useSearchParams } from "react-router-dom";

import { copy } from "@/components/auth/copy";
import { HandoffNotice, useOpenOnce } from "@/components/auth/handoff";
import { Splash } from "@/components/splash";
import { authClient, useSession } from "@/lib/auth";

const CHALLENGE_RE = /^[\w-]{43}$/;

/**
 * `/auth/google?challenge=…`: the app opens it in the system browser (`startNativeGoogle`). It signs
 * in with Google on the web origin, then hands the session to the app as a one-time token bound
 * to `challenge`: without the app's verifier the `mewki://auth?ott=` link opens no session.
 */
export default function AuthGoogle() {
  const raw = useSearchParams()[0].get("challenge");
  const challenge = raw && CHALLENGE_RE.test(raw) ? raw : null;
  const { data: session, isPending } = useSession();
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  // Single shot: StrictMode runs effects twice, and each run would mint a token or redirect.
  const started = useRef(false);

  useEffect(() => {
    if (!challenge || isPending || started.current) return;
    started.current = true;
    const fail = () => setFailed(true);
    if (!session) {
      // Google comes back to this same URL, now with a session.
      authClient.signIn
        .social({
          provider: "google",
          callbackURL: window.location.href,
          errorCallbackURL: `${window.location.origin}/login`,
        })
        .then(({ error }) => error && fail(), fail);
      return;
    }
    authClient
      .$fetch("/one-time-token/generate", { method: "GET", query: { challenge } })
      .then(({ data }) => {
        const token: unknown = typeof data === "object" && data ? Reflect.get(data, "token") : null;
        if (typeof token === "string") setDeepLink(`mewki://auth?ott=${encodeURIComponent(token)}`);
        else fail();
      }, fail);
  }, [challenge, isPending, session]);

  useOpenOnce(deepLink);

  if (challenge && !failed && !deepLink) return <Splash />;

  return (
    <HandoffNotice
      message={!challenge ? copy.verify.invalid : failed ? copy.errors.generic : copy.app.desktop}
      open={deepLink ? { href: deepLink, label: copy.app.open } : undefined}
      browser={
        deepLink
          ? { to: "/dashboard", label: copy.appReturn.browser }
          : { to: "/login", label: copy.app.browser }
      }
    >
      <Helmet>
        <title>{copy.app.pageTitle}</title>
      </Helmet>
    </HandoffNotice>
  );
}
