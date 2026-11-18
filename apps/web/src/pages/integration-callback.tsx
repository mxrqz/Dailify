import { useEffect, useRef } from "react";
import { Loader2Icon } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { isProviderId, MISSING_SCOPE_ERROR } from "@dailify/shared";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { completeIntegration } from "@/functions/api";
import { useEffectEvent } from "@/hooks/useEffectEvent";

const t = copy.integrations;

/** Onde o provedor devolve a pessoa: troca o `code` no servidor e volta pra /integrations com o recado. */
export default function IntegrationCallback(): JSX.Element {
  const { provider } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { reloadMonths, loadedMonths } = useDailify();
  const name = isProviderId(provider) ? copy.calendar.name : "";
  // O state é de uso único: o segundo efeito do StrictMode mandaria um POST que volta 400.
  const started = useRef(false);

  const finish = useEffectEvent(async () => {
    const code = params.get("code");
    const state = params.get("state");
    const fail = (message: string) => {
      toast.error(message.replace("{name}", name));
      navigate("/integrations", { replace: true });
    };

    if (params.get("error") === "access_denied") return fail(t.denied);
    if (!isProviderId(provider) || !code || !state) return fail(t.failed);

    const { error } = await completeIntegration(provider, code, state);
    if (error?.message === MISSING_SCOPE_ERROR) return fail(t.missingScope);
    if (error?.status === 403) return fail(t.wrongUser);
    if (error) return fail(t.failed);

    // O servidor já importou os eventos da Agenda: a lista relê os meses pra eles aparecerem.
    void reloadMonths(loadedMonths);
    toast.success(t.connected.replace("{name}", name));
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
      <p className="text-subhead text-ink-secondary">{t.connecting.replace("{name}", name)}</p>
    </main>
  );
}
