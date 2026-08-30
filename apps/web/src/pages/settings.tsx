import { copy } from "@/components/dashboard/copy";
import { ThemeSelect } from "@/components/mode-toggle";
import { PushToggle } from "@/components/dashboard/push-toggle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage(): JSX.Element {
  return (
    <main className="flex w-full flex-col gap-6 py-6">
      {/* sr-only: a sidebar e o title do Helmet já nomeiam a página na tela */}
      <h1 className="sr-only">{copy.profile.settingsPageTitle}</h1>

      <div className="flex flex-col gap-6">
        <Card className="rounded-2xl border-surface-line bg-surface-card">
          <CardHeader>
            <CardTitle>{copy.profile.themeTitle}</CardTitle>
            <CardDescription className="text-content-secondary">
              {copy.profile.themeDescription}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <ThemeSelect />
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-surface-line bg-surface-card">
          <CardHeader>
            <CardTitle>{copy.profile.notificationsTitle}</CardTitle>
            <CardDescription className="text-content-secondary">
              {copy.profile.notificationsDescription}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <PushToggle />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
