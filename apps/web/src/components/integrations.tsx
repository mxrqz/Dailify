import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@clerk/clerk-react";
import {
  CalendarIcon,
  CalendarPlusIcon,
  CheckIcon,
  LayoutGridIcon,
  Loader2Icon,
  LockIcon,
  PlusIcon,
  Repeat2Icon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { INTEGRATIONS, type IntegrationStatus, type ProviderId } from "@dailify/shared";

import { copy } from "@/components/dashboard/copy";
import { ListGroup, ListRow } from "@/components/kit/list";
import { SegmentedControl } from "@/components/kit/segmented-control";
import { Switch } from "@/components/kit/switch";
import {
  GitHubLogo,
  GmailLogo,
  NotionLogo,
  SlackLogo,
} from "@/components/landing/sections/world/logos";
import { GoogleCalendarLogo } from "@/components/logos";
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
import { useCalendarDefault } from "@/hooks/useCalendarDefault";
import { useHideExternalEvents } from "@/hooks/useExternalEvents";
import { patchIntegration, setIntegrations, useIntegrations } from "@/hooks/useIntegrations";
import { useOnline } from "@/hooks/useOnline";

const t = copy.integrations;
// ponytail: um provedor só no catálogo; com o segundo, o card vira um por `PROVIDER_IDS`.
const GCAL: ProviderId = "google-calendar";
const NAME = INTEGRATIONS[GCAL].name;
const named = (text: string) => text.replace("{name}", NAME);
const tag =
  "rounded-full bg-fill px-2.5 py-0.5 text-footnote font-medium whitespace-nowrap text-ink-secondary";

const active = (s?: IntegrationStatus) => !!s?.connected && s.status !== "revoked";

/** Por device (localStorage), como o modo do composer: é preferência de tela, não da conta. */
export function ShowEventsRow({ icon }: { icon?: boolean }): JSX.Element {
  const [hidden, setHidden] = useHideExternalEvents();
  return (
    <ListRow
      icon={icon && <CalendarIcon />}
      label={copy.calendar.showEvents}
      trailing={
        <Switch
          aria-label={copy.calendar.showEvents}
          checked={!hidden}
          onCheckedChange={(on) => setHidden(!on)}
        />
      }
    />
  );
}

/** O padrão da etiqueta Google Agenda do composer (Sempre/Nunca), também por device. */
export function CalendarDefaultRow({ icon }: { icon?: boolean }): JSX.Element {
  const [always, setAlways] = useCalendarDefault();
  return (
    <ListRow
      icon={icon && <CalendarPlusIcon />}
      label={t.calendarDefault}
      sublabel={t.calendarDefaultHint}
      below={
        <SegmentedControl
          aria-label={t.calendarDefault}
          value={always ? "always" : "never"}
          onValueChange={(value) => setAlways(value === "always")}
          options={[
            { value: "always", label: t.always },
            { value: "never", label: t.never },
          ]}
        />
      }
    />
  );
}

/**
 * O card de um provedor em /integrations: logo, conta, o que ele faz, as linhas de ajuste
 * (`children`) e a ação embaixo. Só props.
 */
export function IntegrationCard({
  logo,
  name,
  account,
  connected,
  does,
  action,
  children,
}: {
  logo: ReactNode;
  name: string;
  account?: ReactNode;
  connected?: boolean;
  does: readonly string[];
  action: ReactNode;
  children?: ReactNode;
}): JSX.Element {
  const icons = [PlusIcon, Repeat2Icon];
  return (
    <div className="card rounded-lg py-4">
      <div className="flex items-center gap-3 px-4">
        <span className="grid size-11 flex-none place-items-center rounded-sm bg-fill [&_svg]:size-7">
          {logo}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-body font-semibold">{name}</span>
          {account && <span className="truncate text-footnote text-ink-secondary">{account}</span>}
        </div>
        {connected && (
          <span className="inline-flex flex-none items-center gap-1 text-footnote font-semibold text-ink-secondary">
            <CheckIcon className="size-3.5" strokeWidth={3} aria-hidden="true" />
            {t.connectedState}
          </span>
        )}
      </div>
      <ul className="mt-4 mb-3 flex flex-col gap-2 px-4">
        {does.map((line, i) => {
          const Icon = icons[i % icons.length];
          return (
            <li key={line} className="flex items-center gap-2.5 text-subhead text-ink-secondary">
              <Icon className="size-4 flex-none" aria-hidden="true" />
              {line}
            </li>
          );
        })}
      </ul>
      {children}
      <div className="flex flex-col gap-2 px-4 pt-2 *:w-full">{action}</div>
    </div>
  );
}

const UPCOMING = [
  { ...t.upcoming.gmail, Logo: GmailLogo },
  { ...t.upcoming.slack, Logo: SlackLogo },
  { ...t.upcoming.notion, Logo: NotionLogo },
  // O do GitHub é uma silhueta: vai na cor do texto pra não sumir no escuro.
  { ...t.upcoming.github, Logo: GitHubLogo, fill: "currentColor" },
];

/** O que ainda não existe, só pra mostrar o rumo. */
export function UpcomingIntegrations(): JSX.Element {
  return (
    <ListGroup title={t.soon}>
      {UPCOMING.map(({ name, hint, Logo, ...logo }) => (
        <ListRow
          key={name}
          icon={<Logo {...logo} className="text-ink" />}
          label={name}
          sublabel={hint}
          trailing={<span className={tag}>{t.soon}</span>}
        />
      ))}
    </ListGroup>
  );
}

/** O corpo de /integrations: o card do Google Agenda (conectar, ajustes, desconectar) e o Em breve. */
export function Integrations(): JSX.Element {
  const { getToken } = useAuth();
  const online = useOnline();
  // undefined = carregando; null = não deu pra ler (rede ou servidor).
  const [statuses, setStatuses] = useState<IntegrationStatus[] | null>();
  // `configured` do GET já diz; o 503 do connect cobre o servidor que perdeu a credencial depois.
  const [soon, setSoon] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!online) return;
    void (async () => {
      const token = await getToken();
      if (!token) return;
      const { integrations } = await getIntegrations(token);
      setStatuses(integrations ?? null);
      if (integrations) setIntegrations(integrations);
    })();
  }, [getToken, online]);

  const connect = async () => {
    setBusy(true);
    const token = await getToken();
    const { url, error } = token ? await connectIntegration(token, GCAL) : {};
    // Sem `setBusy(false)`: a página vai embora pro consentimento do provedor.
    if (url) return window.location.assign(url);
    setBusy(false);
    if (error?.status === 503) setSoon(true);
    else toast.error(named(t.connectError), { description: error?.message });
  };

  const disconnect = async () => {
    setBusy(true);
    const token = await getToken();
    const { error } = token ? await disconnectIntegration(token, GCAL) : { error: undefined };
    setBusy(false);
    if (!token || error) {
      toast.error(named(t.disconnectError), { description: error?.message });
      return;
    }
    const patch = { connected: false, status: undefined };
    setStatuses((list) => list?.map((s) => (s.provider === GCAL ? { ...s, ...patch } : s)));
    patchIntegration(GCAL, patch);
    toast.success(named(t.disconnected));
  };

  const status = statuses?.find((s) => s.provider === GCAL);
  const connected = active(status);
  const disabled = !online || !status || busy;
  const spinner = busy && <Loader2Icon className="size-4 animate-spin" />;

  let account: ReactNode = status?.account;
  let action: ReactNode;
  if (statuses === undefined && online) {
    action = <Loader2Icon className="mx-auto size-5 animate-spin text-ink-secondary" />;
  } else if (soon || status?.configured === false) {
    action = (
      <Button variant="secondary" disabled>
        {t.soon}
      </Button>
    );
  } else if (connected) {
    action = (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="secondary" disabled={disabled}>
            {spinner || t.disconnect}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{named(t.disconnectTitle)}</DialogTitle>
            <DialogDescription>{t.disconnectDescription}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="secondary">{copy.form.cancel}</Button>
            </DialogClose>
            <DialogClose asChild>
              <Button variant="soft-danger" onClick={() => void disconnect()}>
                {t.disconnect}
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  } else if (status && !status.allowed) {
    account = t.lockedHint;
    action = (
      <Button asChild variant="secondary">
        <Link to="/premium">
          <LockIcon aria-hidden="true" />
          {t.pro}
        </Link>
      </Button>
    );
  } else {
    const revoked = status?.status === "revoked";
    if (revoked) account = t.revokedHint;
    if (!online || statuses === null) account = t.offlineHint;
    action = (
      <Button
        variant={revoked ? "soft-danger" : "default"}
        disabled={disabled}
        onClick={() => void connect()}
      >
        {spinner || (revoked ? t.reconnect : t.connect)}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      <ListGroup title={connected ? t.groupConnected : t.groupAvailable}>
        <IntegrationCard
          logo={<GoogleCalendarLogo aria-hidden="true" />}
          name={NAME}
          account={account}
          connected={connected}
          does={t.does}
          action={action}
        >
          {connected && (
            <>
              <ShowEventsRow />
              <CalendarDefaultRow />
            </>
          )}
        </IntegrationCard>
      </ListGroup>
      <UpcomingIntegrations />
    </div>
  );
}

/** O grupo Integrações de /settings: o resumo do Google Agenda e o caminho pra página inteira. */
export function IntegrationsSummary(): JSX.Element {
  const status = useIntegrations()?.find((s) => s.provider === GCAL);
  const connected = active(status);

  return (
    <ListGroup title={t.group}>
      <ListRow
        asChild
        icon={<GoogleCalendarLogo className="size-6!" />}
        label={NAME}
        sublabel={connected ? status?.account : undefined}
        value={
          connected ? t.connectedState : status?.status === "revoked" ? t.reconnect : undefined
        }
        accessory="chevron"
      >
        <Link to="/integrations" />
      </ListRow>
      {connected && <ShowEventsRow icon />}
      {connected && <CalendarDefaultRow icon />}
      <ListRow asChild icon={<LayoutGridIcon />} label={t.all} accessory="chevron">
        <Link to="/integrations" />
      </ListRow>
    </ListGroup>
  );
}
