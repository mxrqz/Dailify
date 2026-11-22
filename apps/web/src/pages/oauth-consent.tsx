import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Navigate, useLocation } from "react-router-dom";
import { isRecord } from "@dailify/shared";

import { AuthShell } from "@/components/auth/auth-shell";
import { copy } from "@/components/auth/copy";
import { Button } from "@/components/ui/button";
import { fill } from "@/functions/functions";
import { withStepUp } from "@/hooks/useStepUp";
import { authClient, settle, useSession } from "@/lib/auth";

interface Client {
  name?: string;
  logo?: string;
}

const text = (v: unknown) => (typeof v === "string" && v ? v : undefined);

/** Where the client sends the user back: the only part of its identity it can't make up. */
function hostOf(redirectUri: string | null): string | undefined {
  try {
    return redirectUri ? new URL(redirectUri).host : undefined;
  } catch {
    return undefined;
  }
}

export function ConsentView({
  client,
  returnsTo,
  busy,
  failed,
  onDecide,
}: {
  client: Client;
  returnsTo?: string;
  busy: boolean;
  failed: boolean;
  onDecide: (accept: boolean) => void;
}): JSX.Element {
  return (
    <AuthShell
      bubble={copy.consent.bubble}
      title={fill(copy.consent.title, { client: client.name ?? copy.consent.unknownClient })}
      subtitle={copy.consent.grants}
    >
      {client.logo?.startsWith("https://") && (
        <img src={client.logo} alt="" className="mx-auto size-12 rounded-md" />
      )}
      {returnsTo && (
        <p className="text-center text-subhead text-ink-secondary">
          {fill(copy.consent.returnsTo, { host: returnsTo })}
        </p>
      )}
      {failed && (
        <p role="alert" className="text-center text-subhead text-brand-text">
          {copy.consent.failed}
        </p>
      )}
      <Button size="lg" className="w-full" disabled={busy} onClick={() => onDecide(true)}>
        {copy.consent.allow}
      </Button>
      <Button
        size="lg"
        variant="secondary"
        className="w-full"
        disabled={busy}
        onClick={() => onDecide(false)}
      >
        {copy.consent.deny}
      </Button>
    </AuthShell>
  );
}

/**
 * `/oauth/consent?<signed authorize query>`: Better Auth's consent page for MCP clients. The
 * `oauthProviderClient` plugin sends that query with the POST, so the answer only needs `accept`.
 */
export default function OAuthConsent() {
  const { search } = useLocation();
  const { data: session, isPending } = useSession();
  const params = new URLSearchParams(search);
  const clientId = params.get("client_id");
  const [client, setClient] = useState<Client>({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const signedIn = Boolean(session);

  useEffect(() => {
    if (!signedIn || !clientId) return;
    let live = true;
    void settle(
      authClient.$fetch("/oauth2/public-client", { query: { client_id: clientId } }),
    ).then(({ data }) => {
      if (live && isRecord(data))
        setClient({ name: text(data.client_name), logo: text(data.logo_uri) });
    });
    return () => {
      live = false;
    };
  }, [signedIn, clientId]);

  const decide = async (accept: boolean) => {
    setBusy(true);
    setFailed(false);
    // Granting reach to an assistant is a sensitive action: with MFA on, a recent second factor.
    const { data } = await withStepUp(() =>
      settle(authClient.$fetch("/oauth2/consent", { method: "POST", body: { accept } })),
    );
    // The client's redirect_uri (with the code, or access_denied): a full navigation off the app.
    if (isRecord(data) && typeof data.url === "string") return window.location.assign(data.url);
    setBusy(false);
    setFailed(true);
  };

  if (isPending) return null;
  // The login page resumes here with the same query (`redirectTarget`).
  if (!session) return <Navigate to={`/login${search}`} replace />;

  return (
    <>
      <Helmet>
        <title>{copy.consent.pageTitle}</title>
      </Helmet>
      <ConsentView
        client={client}
        returnsTo={hostOf(params.get("redirect_uri"))}
        busy={busy}
        failed={failed}
        onDecide={(accept) => void decide(accept)}
      />
    </>
  );
}
