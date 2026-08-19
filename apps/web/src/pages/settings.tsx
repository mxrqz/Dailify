import { copy } from "@/components/dashboard/copy";
import { ThemeSelect } from "@/components/mode-toggle";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage(): JSX.Element {
  return (
    <main className="flex w-full flex-col gap-6 py-6">
      <PageHeader title={copy.profile.settingsPageTitle} />

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
            <p className="text-sm text-content-secondary">{copy.profile.notificationsSoon}</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
