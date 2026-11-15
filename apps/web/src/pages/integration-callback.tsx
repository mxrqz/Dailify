import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/clerk-react";
import { Loader2Icon } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { INTEGRATIONS, isProviderId, MISSING_SCOPE_ERROR } from "@dailify/shared";

import { copy } from "@/components/dashboard/copy";
import { completeIntegration } from "@/functions/api";
import { useEffectEvent } from "@/hooks/useEffectEvent";

const t = copy.integrations;

/** Onde o provedor devolve a pessoa: troca o `code` no servidor e volta pra /settings com o recado. */
export default function IntegrationCallback(): JSX.Element {
  const { provider } = useParams();
  const [params] = useSearchParams();
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const name = isProviderId(provider) ? INTEGRATIONS[provider].name : "";
  // O state é de uso único: o segundo efeito do StrictMode mandaria um POST que volta 400.
  const started = useRef(false);

  const finish = useEffectEvent(async () => {
    const code = params.get("code");
    const state = params.get("state");
    const fail = (message: string) => {
      toast.error(message.replace("{name}", name));
      navigate("/settings", { replace: true });
    };

    if (params.get("error") === "access_denied") return fail(t.denied);
    if (!isProviderId(provider) || !code || !state) return fail(t.failed);

    const token = await getToken();
    const { error } = token ? await completeIntegration(token, provider, code, state) : {};
    if (!token) return fail(t.failed);
    if (error?.message === MISSING_SCOPE_ERROR) return fail(t.missingScope);
    if (error?.status === 403) return fail(t.wrongUser);
    if (error) return fail(t.failed);

    toast.success(t.connected.replace("{name}", name));
    navigate("/settings", { replace: true });
  });

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void finish();
  }, []);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3" aria-busy="true">
      <Loader2Icon className="size-6 animate-spin text-primary" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{t.connecting.replace("{name}", name)}</p>
    </main>
  );
}
