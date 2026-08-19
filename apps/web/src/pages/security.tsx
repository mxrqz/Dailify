import { useUser, useSession } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import type { SessionWithActivitiesResource } from "@clerk/types";
import { formatRelative } from "date-fns";
import { EllipsisVerticalIcon, Laptop2Icon, Smartphone } from "lucide-react";

import { copy } from "@/components/dashboard/copy";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

export default function SecurityPage(): JSX.Element {
  const { user } = useUser();
  const { session: currentSession } = useSession();
  const [sessions, setSessions] = useState<SessionWithActivitiesResource[]>();

  const getSessions = async () => {
    const sessions = await user?.getSessions();
    if (sessions) setSessions(sessions);
  };

  useEffect(() => {
    getSessions();
  }, []);

  return (
    <main className="flex w-full flex-col gap-6 py-6">
      {/* sr-only: a sidebar e o title do Helmet já nomeiam a página na tela */}
      <h1 className="sr-only">{copy.profile.securityPageTitle}</h1>

      <div className="flex flex-col gap-6">
        <Card className="rounded-2xl border-surface-line bg-surface-card">
          <CardHeader>
            <CardTitle>Segurança da Conta</CardTitle>
            <CardDescription className="text-content-secondary">
              Gerencie as configurações de segurança da sua conta.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <h4 className="text-base font-medium">Senha</h4>
                </div>

                <Button disabled>Alterar senha</Button>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="text-base font-medium">Sessões ativas</h4>
                <p className="text-sm text-content-secondary">
                  Dispositivos atualmente conectados à sua conta.
                </p>

                <div className="space-y-4">
                  {sessions &&
                    // ordena antes de cortar: o inverso pegava 3 sessões arbitrárias da ordem do
                    // Clerk e só então as ordenava, em vez das 3 mais recentes
                    [...sessions]
                      .sort((a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime())
                      .slice(0, 3)
                      .map((session) => (
                        <div
                          key={session.id}
                          className="grid grid-cols-[25%_45%_25%_5%] items-center"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-subtle">
                              {session.latestActivity.isMobile ? (
                                <Smartphone className="h-5 w-5 text-foreground" />
                              ) : (
                                <Laptop2Icon className="h-5 w-5 text-foreground" />
                              )}
                            </div>

                            <div className="flex flex-col gap-1">
                              <div className="flex gap-2">
                                <p className="font-medium">{session.latestActivity.deviceType}</p>

                                <div className="flex items-center gap-2">
                                  {session.id === currentSession?.id && (
                                    <Badge
                                      variant="outline"
                                      className="border-success text-2xs py-0.5 px-1"
                                    >
                                      Atual
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              <p className="text-xs text-muted-foreground">
                                {session.latestActivity.browserName}{" "}
                                {session.latestActivity.browserVersion}
                              </p>
                            </div>
                          </div>

                          <span className="text-sm text-content-secondary">
                            {session.latestActivity.ipAddress} ({session.latestActivity.city},{" "}
                            {session.latestActivity.country})
                          </span>

                          <span className="text-sm text-content-secondary">
                            {formatRelative(session.lastActiveAt, new Date())}
                          </span>

                          <Popover>
                            <PopoverTrigger className="justify-self-end cursor-pointer" asChild>
                              <Button size={"icon"} variant={"ghost"}>
                                <EllipsisVerticalIcon />
                              </Button>
                            </PopoverTrigger>

                            <PopoverContent align="end" className="p-1">
                              <Button
                                variant="ghost"
                                className="h-7 w-full justify-start px-2 py-0 text-start text-destructive hover:text-destructive"
                                onClick={() => session.revoke()}
                              >
                                {copy.profile.revokeDevice}
                              </Button>
                            </PopoverContent>
                          </Popover>
                        </div>
                      ))}
                </div>

                <Button variant="outline" size="sm">
                  Ver todos os dispositivos
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
