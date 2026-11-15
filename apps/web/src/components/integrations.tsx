import { useEffect, useState, type ComponentType, type SVGProps } from "react";
import { useAuth } from "@clerk/clerk-react";
import { Loader2Icon, LockIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  INTEGRATIONS,
  PROVIDER_IDS,
  type IntegrationStatus,
  type ProviderId,
} from "@dailify/shared";

import { copy } from "@/components/dashboard/copy";
import { GoogleCalendarLogo } from "@/components/logos";
import { SettingsGroup, SettingsRow } from "@/components/settings-list";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { connectIntegration, disconnectIntegration, getIntegrations } from "@/functions/api";
import { useOnline } from "@/hooks/useOnline";

const LOGOS: Record<ProviderId, ComponentType<SVGProps<SVGSVGElement>>> = {
  "google-calendar": GoogleCalendarLogo,
};

const t = copy.integrations;
const named = (text: string, id: ProviderId) => text.replace("{name}", INTEGRATIONS[id].name);
const button = "rounded-sm";

/** O grupo Integrações de /settings: uma linha por provedor do catálogo compartilhado. */
export function IntegrationsGroup(): JSX.Element {
  const { getToken } = useAuth();
  const online = useOnline();
  // undefined = carregando; null = não deu pra ler (rede ou servidor).
  const [statuses, setStatuses] = useState<IntegrationStatus[] | null>();
  // O GET não diz se o servidor tem as credenciais; o 503 do connect é quem conta.
  const [soon, setSoon] = useState<ProviderId[]>([]);
  const [busy, setBusy] = useState<ProviderId | null>(null);

  useEffect(() => {
    if (!online) return;
    void (async () => {
      const token = await getToken();
      if (!token) return;
      const { integrations } = await getIntegrations(token);
      setStatuses(integrations ?? null);
    })();
  }, [getToken, online]);

  const connect = async (id: ProviderId) => {
    setBusy(id);
    const token = await getToken();
    const { url, error } = token ? await connectIntegration(token, id) : {};
    // Sem `setBusy(null)`: a página vai embora pro consentimento do provedor.
    if (url) return window.location.assign(url);
    setBusy(null);
    if (error?.status === 503) setSoon((s) => [...s, id]);
    else toast.error(named(t.connectError, id), { description: error?.message });
  };

  const disconnect = async (id: ProviderId) => {
    setBusy(id);
    const token = await getToken();
    const { error } = token ? await disconnectIntegration(token, id) : { error: undefined };
    setBusy(null);
    if (!token || error) {
      toast.error(named(t.disconnectError, id), { description: error?.message });
      return;
    }
    setStatuses((list) =>
      list?.map((s) => (s.provider === id ? { ...s, connected: false, status: undefined } : s)),
    );
    toast.success(named(t.disconnected, id));
  };

  return (
    <SettingsGroup title={t.group}>
      {PROVIDER_IDS.map((id) => {
        const Logo = LOGOS[id];
        const status = statuses?.find((s) => s.provider === id);
        const disabled = !online || !status || busy !== null;
        const spinner = busy === id && <Loader2Icon className="size-4 animate-spin" />;

        let hint: string | undefined;
        let control: JSX.Element;
        if (statuses === undefined && online) {
          control = <Loader2Icon className="size-4 animate-spin text-muted-foreground" />;
        } else if (soon.includes(id)) {
          control = (
            <Button size="sm" variant="outline" disabled className={button}>
              {t.soon}
            </Button>
          );
        } else if (status?.connected && status.status !== "revoked") {
          hint = status.account;
          control = (
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" disabled={disabled} className={button}>
                  {spinner || t.disconnect}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{named(t.disconnectTitle, id)}</DialogTitle>
                  <DialogDescription>{t.disconnectDescription}</DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2">
                  <DialogClose asChild>
                    <Button variant="outline">{copy.form.cancel}</Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button variant="destructive" onClick={() => void disconnect(id)}>
                      {t.disconnect}
                    </Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          );
        } else if (status && !status.allowed) {
          hint = t.lockedHint;
          control = (
            <Button asChild size="sm" variant="outline" className={button}>
              <Link to="/premium">
                <LockIcon aria-hidden="true" />
                {t.pro}
              </Link>
            </Button>
          );
        } else {
          const revoked = status?.status === "revoked";
          if (revoked) hint = t.revokedHint;
          if (!online || statuses === null) hint = t.offlineHint;
          control = (
            <Button
              size="sm"
              variant={revoked ? "destructive" : "default"}
              disabled={disabled}
              onClick={() => void connect(id)}
              className={button}
            >
              {spinner || (revoked ? t.reconnect : t.connect)}
            </Button>
          );
        }

        return (
          <SettingsRow
            key={id}
            label={INTEGRATIONS[id].name}
            hint={hint}
            icon={<Logo className="size-5" aria-hidden="true" />}
          >
            {control}
          </SettingsRow>
        );
      })}
    </SettingsGroup>
  );
}
