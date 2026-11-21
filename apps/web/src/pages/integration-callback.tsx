import { useEffect, useRef } from "react";
import { Loader2Icon } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { API_ERROR, isProviderId } from "@dailify/shared";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { completeIntegration } from "@/functions/api";
import { fill } from "@/functions/functions";
import { useEffectEvent } from "@/hooks/useEffectEvent";

const t = copy.integrations;

/** Onde o provedor devolve a pessoa: troca o `code` no servidor e volta pra /integrations com o recado. */
export default function IntegrationCallback(): JSX.Element {
  const { provider } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { reloadMonths, loadedMonths } = useDailify();
  const app = isProviderId(provider) ? t.apps[provider] : undefined;
  const name = app?.name ?? "";
  // O state é de uso único: o segundo efeito do StrictMode mandaria um POST que volta 400.
  const started = useRef(false);

  const finish = useEffectEvent(async () => {
    const code = params.get("code");
    const state = params.get("state");
    const fail = (message: string) => {
      toast.error(fill(message, { name }));
      navigate("/integrations", { replace: true });
    };

    if (!app || !isProviderId(provider)) return fail(t.failed);
    if (params.get("error") === "access_denied") return fail(app.denied);
    if (!code || !state) return fail(t.failed);

    const { error } = await completeIntegration(provider, code, state);
    if (error?.code === API_ERROR.missingScope) return fail(app.missingScope);
    if (error?.status === 403) return fail(t.wrongUser);
    if (error) return fail(t.failed);

    // O servidor já importou os eventos da Agenda: a lista relê os meses pra eles aparecerem.
    void reloadMonths(loadedMonths);
    toast.success(app.connected);
    navigate("/integrations", { replace: true });
  });

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void finish();
  }, []);

  return (
    <main className="flex flex-col items-center gap-3 pt-24" aria-busy="true">
      <Loader2Icon className="size-6 animate-spin text-ink-secondary" aria-hidden="true" />
      <p className="text-subhead text-ink-secondary">{fill(t.connecting, { name })}</p>
    </main>
  );
}
