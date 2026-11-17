import { useSession, useUser } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import type { SessionWithActivitiesResource } from "@clerk/types";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MonitorIcon, SmartphoneIcon } from "lucide-react";

import { copy } from "@/components/dashboard/copy";
import { ListGroup, ListRow } from "@/components/kit/list";
import { PageHeader } from "@/components/kit/page-header";
import { accountGroups, accountPage } from "@/components/settings-list";
import { Button } from "@/components/ui/button";
import { useEffectEvent } from "@/hooks/useEffectEvent";

/** Uma sessão: o aparelho, onde e quando, e "Este aparelho" ou o "Encerrar" vermelho suave. */
export function SessionRow({
  mobile,
  label,
  meta,
  current,
  onRevoke,
}: {
  mobile: boolean;
  label: string;
  meta: string;
  current: boolean;
  onRevoke: () => void;
}): JSX.Element {
  const Icon = mobile ? SmartphoneIcon : MonitorIcon;
  return (
    <ListRow
      icon={<Icon />}
      label={label}
      sublabel={meta}
      trailing={
        current ? (
          <span className="rounded-full bg-fill px-2.5 py-0.5 text-footnote font-medium whitespace-nowrap text-ink-secondary">
            {copy.profile.thisDevice}
          </span>
        ) : (
          <Button
            variant="soft-danger"
            size="sm"
            className="relative hit-target"
            onClick={onRevoke}
          >
            {copy.profile.revokeDevice}
          </Button>
        )
      }
    />
  );
}

export default function SecurityPage(): JSX.Element {
  const { user } = useUser();
  const { session: currentSession } = useSession();
  const [sessions, setSessions] = useState<SessionWithActivitiesResource[]>();

  const load = async () => {
    const all = await user?.getSessions();
    if (all) setSessions(all);
  };

  // Uma vez ao abrir; depois, só o revogar relê.
  const loadOnOpen = useEffectEvent(load);
  useEffect(() => {
    void loadOnOpen();
  }, []);

  const revoke = async (session: SessionWithActivitiesResource) => {
    await session.revoke();
    await load();
  };

  return (
    <main className={accountPage}>
      <PageHeader
        title={copy.profile.securityPageTitle}
        subtitle={copy.profile.securityLead}
        className="px-1"
      />

      <div className={accountGroups}>
        <ListGroup title={copy.profile.groupSessions} footer={copy.profile.sessionsFooter}>
          {[...(sessions ?? [])]
            .sort((a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime())
            .map((session) => {
              const { browserName, deviceType, isMobile, city, country } = session.latestActivity;
              const place = [city, country].filter(Boolean).join(", ");
              const when = formatDistanceToNow(session.lastActiveAt, {
                addSuffix: true,
                locale: ptBR,
              });
              return (
                <SessionRow
                  key={session.id}
                  mobile={!!isMobile}
                  label={[browserName, deviceType].filter(Boolean).join(" · ")}
                  meta={
                    place
                      ? copy.profile.sessionMeta.replace("{place}", place).replace("{when}", when)
                      : when
                  }
                  current={session.id === currentSession?.id}
                  onRevoke={() => void revoke(session)}
                />
              );
            })}
        </ListGroup>
      </div>
    </main>
  );
}
