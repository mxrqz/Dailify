import { useEffect, useState, type ReactNode } from "react";
import {
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
import { PROVIDER_IDS, type IntegrationStatus, type ProviderId } from "@dailify/shared";

import { copy } from "@/components/dashboard/copy";
import { ListGroup, ListRow } from "@/components/kit/list";
import { SegmentedControl } from "@/components/kit/segmented-control";
import { Switch } from "@/components/kit/switch";
import {
  GitHubLogo,
  GmailLogo,
  GoogleCalendarLogo,
  NotionLogo,
  SlackLogo,
} from "@/components/logos";
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
import {
  connectIntegration,
  disconnectIntegration,
  getIntegrations,
  revokeReadGrant,
} from "@/functions/api";
import { fill } from "@/functions/functions";
import { useCalendarDefault } from "@/hooks/useCalendarDefault";
import {
  patchIntegration,
  setIntegrations,
  useIntegration,
  useIntegrations,
} from "@/hooks/useIntegrations";
import { useOnline } from "@/hooks/useOnline";
import { withStepUp } from "@/hooks/useStepUp";
import { isTauri } from "@/lib/platform";
import { openExternal } from "@/lib/open-external";

const t = copy.integrations;
const GCAL: ProviderId = "google-calendar";
const NAME = copy.calendar.name;
const tag =
  "rounded-full bg-fill px-2.5 py-0.5 text-footnote font-medium whitespace-nowrap text-ink-secondary";

const active = (s?: IntegrationStatus) => !!s?.connected && s.status !== "revoked";

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
  note,
  children,
}: {
  logo: ReactNode;
  name: string;
  account?: ReactNode;
  connected?: boolean;
  does: readonly string[];
  action: ReactNode;
  /** Recado curto embaixo da ação ("3 eventos ficaram só na Agenda"). */
  note?: string;
  children?: ReactNode;
}): JSX.Element {
  const icons = [PlusIcon, Repeat2Icon];
  return (
    <div className="py-4 not-first:border-t not-first:border-separator">
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
      {note && <p className="px-4 pt-3 text-footnote text-ink-secondary">{note}</p>}
    </div>
  );
}

const UPCOMING = [{ ...t.upcoming.notion, Logo: NotionLogo }];

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

const LOGOS = {
  "google-calendar": GoogleCalendarLogo,
  slack: SlackLogo,
  gmail: GmailLogo,
  github: GitHubLogo,
} satisfies Record<ProviderId, unknown>;

/** O card de um provedor com conectar, desconectar e o "lê sem perguntar"; a Agenda leva os ajustes dela. */
function ProviderCard({
  id,
  statuses,
}: {
  id: ProviderId;
  /** undefined = loading; null = couldn't read (network or server). */
  statuses: IntegrationStatus[] | null | undefined;
}): JSX.Element {
  const online = useOnline();
  const app = t.apps[id];
  const named = (text: string) => fill(text, { name: app.name });
  const Logo = LOGOS[id];
  // `configured` do GET já diz; o 503 do connect cobre o servidor que perdeu a credencial depois.
  const [soon, setSoon] = useState(false);
  const [busy, setBusy] = useState(false);

  const connect = async () => {
    setBusy(true);
    const { url, error } = await withStepUp(() => connectIntegration(id));
    // Na web, sem `setBusy(false)`: a página vai embora pro consentimento do provedor.
    if (url) {
      await openExternal(url);
      if (isTauri()) setBusy(false);
      return;
    }
    setBusy(false);
    if (error?.status === 503) setSoon(true);
    else toast.error(named(t.connectError), { description: error?.message });
  };

  const disconnect = async () => {
    setBusy(true);
    const { error } = await disconnectIntegration(id);
    setBusy(false);
    if (error) {
      toast.error(named(t.disconnectError), { description: error?.message });
      return;
    }
    patchIntegration(id, { connected: false, status: undefined });
    toast.success(app.disconnected);
  };

  const revokeRead = async () => {
    patchIntegration(id, { readAlways: undefined });
    const { error } = await revokeReadGrant(id);
    if (!error) return;
    patchIntegration(id, { readAlways: true });
    toast.error(t.readAlwaysError, { description: error.message });
  };

  const status = statuses?.find((s) => s.provider === id);
  const calendar = id === GCAL;
  const connected = active(status);
  const disabled = !online || !status || busy;

  const skipped = status?.skipped ?? 0;
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
      <>
        {status?.tasksMissing && (
          <Button disabled={disabled} loading={busy} onClick={() => void connect()}>
            {t.reconnect}
          </Button>
        )}
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary" disabled={disabled} loading={busy}>
              {t.disconnect}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{named(t.disconnectTitle)}</DialogTitle>
              <DialogDescription>{app.disconnectDescription}</DialogDescription>
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
      </>
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
        loading={busy}
        onClick={() => void connect()}
      >
        {revoked ? t.reconnect : t.connect}
      </Button>
    );
  }

  return (
    <IntegrationCard
      logo={<Logo aria-hidden="true" />}
      name={app.name}
      account={account}
      connected={connected}
      does={app.does}
      action={action}
      note={
        calendar && connected && status?.tasksMissing
          ? t.tasksMissing
          : calendar && connected && skipped > 0
            ? skipped === 1
              ? copy.calendar.skippedOne
              : fill(copy.calendar.skippedMany, { n: skipped })
            : id === "github" && !connected && status?.allowed
              ? t.githubScopeHint
              : undefined
      }
    >
      {calendar && connected && <CalendarDefaultRow />}
      {connected && status?.readAlways && (
        <ListRow
          label={t.readAlways}
          sublabel={t.readAlwaysHint}
          trailing={
            <Switch
              checked
              aria-label={t.readAlways}
              disabled={!online}
              onCheckedChange={() => void revokeRead()}
            />
          }
        />
      )}
    </IntegrationCard>
  );
}

/** O corpo de /integrations: um card por provedor, os conectados primeiro, e o Em breve. */
export function Integrations(): JSX.Element {
  const online = useOnline();
  const stored = useIntegrations();
  // The store has no failure state: a failed read with nothing stored shows the offline hint.
  const [failed, setFailed] = useState(false);
  const statuses = stored ?? (failed ? null : undefined);

  useEffect(() => {
    if (!online) return;
    void (async () => {
      const { integrations } = await getIntegrations();
      setFailed(!integrations);
      if (integrations) setIntegrations(integrations);
    })();
  }, [online]);

  // Until the list arrives every provider shows; after, only the ones the server knows.
  const ids = statuses
    ? PROVIDER_IDS.filter((id) => statuses.some((s) => s.provider === id))
    : PROVIDER_IDS;
  const on = (id: ProviderId) => active(statuses?.find((s) => s.provider === id));
  const groups = [
    { title: t.groupConnected, list: ids.filter(on) },
    { title: t.groupAvailable, list: ids.filter((id) => !on(id)) },
  ];

  return (
    <div className="flex flex-col gap-7">
      {groups.map(
        ({ title, list }) =>
          list.length > 0 && (
            <ListGroup key={title} title={title}>
              {list.map((id) => (
                <ProviderCard key={id} id={id} statuses={statuses} />
              ))}
            </ListGroup>
          ),
      )}
      <UpcomingIntegrations />
    </div>
  );
}

/** O grupo Integrações de /settings: o resumo do Google Agenda e o caminho pra página inteira. */
export function IntegrationsSummary(): JSX.Element {
  const status = useIntegration(GCAL);
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
      {connected && <CalendarDefaultRow icon />}
      <ListRow asChild icon={<LayoutGridIcon />} label={t.all} accessory="chevron">
        <Link to="/integrations" />
      </ListRow>
    </ListGroup>
  );
}
