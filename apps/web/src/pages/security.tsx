import { useSession, useUser } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import type { SessionWithActivitiesResource } from "@clerk/types";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MonitorIcon, SmartphoneIcon } from "lucide-react";

import { copy } from "@/components/dashboard/copy";
import { SettingsGroup, SettingsRow, settingsPage } from "@/components/settings-list";
import { Button } from "@/components/ui/button";
import { useEffectEvent } from "@/hooks/useEffectEvent";

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
    <main className={settingsPage}>
      {/* sr-only: a sidebar e o title do Helmet já nomeiam a página na tela */}
      <h1 className="sr-only">{copy.profile.securityPageTitle}</h1>

      <SettingsGroup title={copy.profile.groupSessions}>
        {[...(sessions ?? [])]
          .sort((a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime())
          .map((session) => {
            const { browserName, deviceType, isMobile, city, country } = session.latestActivity;
            const current = session.id === currentSession?.id;
            const place = [city, country].filter(Boolean).join(", ");
            const when = formatDistanceToNow(session.lastActiveAt, {
              addSuffix: true,
              locale: ptBR,
            });
            const Icon = isMobile ? SmartphoneIcon : MonitorIcon;
            return (
              <SettingsRow
                key={session.id}
                icon={<Icon className="size-4" />}
                label={[browserName, deviceType].filter(Boolean).join(" · ")}
                hint={
                  place
                    ? copy.profile.sessionMeta.replace("{place}", place).replace("{when}", when)
                    : when
                }
              >
                {current ? (
                  <span className="rounded-md bg-surface-hover px-2 py-0.5 text-2xs text-content-secondary">
                    {copy.profile.thisDevice}
                  </span>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="cursor-pointer text-muted-foreground"
                    onClick={() => void revoke(session)}
                  >
                    {copy.profile.revokeDevice}
                  </Button>
                )}
              </SettingsRow>
            );
          })}
      </SettingsGroup>
    </main>
  );
}
