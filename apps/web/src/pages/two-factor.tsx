import { Helmet } from "react-helmet-async";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";

import { AuthShell } from "@/components/auth/auth-shell";
import { copy } from "@/components/auth/copy";
import { MfaChallenge, useSecondFactor } from "@/components/auth/mfa-challenge";
import { useSession } from "@/lib/auth";
import { internalPath, isTauri } from "@/lib/platform";

/**
 * `/two-factor?next=`: the second factor after any first one (password, link, code, Google). The
 * challenge lives in the server's `two_factor` cookie (in the app, in memory); `next` is untrusted.
 */
export default function TwoFactor() {
  const navigate = useNavigate();
  const next = internalPath(useSearchParams()[0].get("next"));
  const { data: session } = useSession();
  const challenge = useSecondFactor(() => navigate(next, { replace: true }));

  if (session) return <Navigate to={next} replace />;

  return (
    <AuthShell onBack={() => navigate("/login", { replace: true })}>
      <Helmet>
        <title>{copy.mfa.pageTitle}</title>
      </Helmet>
      {/* The app's trust cookie wouldn't survive the webview: it isn't offered there. */}
      <MfaChallenge {...challenge} showTrust={!isTauri()} />
    </AuthShell>
  );
}
