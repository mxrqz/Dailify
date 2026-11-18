import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MonitorIcon, SmartphoneIcon } from "lucide-react";
import { toast } from "sonner";

import { copy } from "@/components/dashboard/copy";
import { ListGroup, ListRow } from "@/components/kit/list";
import { PageHeader } from "@/components/kit/page-header";
import { accountGroups, accountPage } from "@/components/settings-list";
import { Button } from "@/components/ui/button";
import { fill } from "@/functions/functions";
import { parseUserAgent } from "@/functions/user-agent";
import { useEffectEvent } from "@/hooks/useEffectEvent";
import { authClient, settle, useSession } from "@/lib/auth";

type Session = typeof authClient.$Infer.Session.session;

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
  const currentId = useSession().data?.session.id;
  const [sessions, setSessions] = useState<Session[]>();

  const load = async () => {
    const { data, error } = await settle(authClient.listSessions());
    if (error) return void toast.error(copy.profile.sessionsError);
    if (data) setSessions(data);
  };

  // Uma vez ao abrir; depois, só o revogar relê.
  const loadOnOpen = useEffectEvent(load);
  useEffect(() => {
    void loadOnOpen();
  }, []);

  const revoke = async (token: string) => {
    const { error } = await settle(authClient.revokeSession({ token }));
    if (error) toast.error(copy.profile.revokeError);
    await load();
  };

  const revokeOthers = async () => {
    const { error } = await settle(authClient.revokeOtherSessions());
    if (error) toast.error(copy.profile.revokeError);
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
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .map((session) => {
              const { browser, os, mobile } = parseUserAgent(session.userAgent);
              const when = formatDistanceToNow(session.updatedAt, {
                addSuffix: true,
                locale: ptBR,
              });
              return (
                <SessionRow
                  key={session.id}
                  mobile={mobile}
                  label={[browser, os].filter(Boolean).join(" · ") || copy.profile.unknownDevice}
                  meta={
                    session.ipAddress
                      ? fill(copy.profile.sessionMeta, { place: session.ipAddress, when })
                      : when
                  }
                  current={session.id === currentId}
                  onRevoke={() => void revoke(session.token)}
                />
              );
            })}
        </ListGroup>

        {sessions && sessions.length > 1 && (
          <ListGroup>
            <ListRow label={copy.profile.revokeOthers} danger onClick={() => void revokeOthers()} />
          </ListGroup>
        )}
      </div>
    </main>
  );
}
