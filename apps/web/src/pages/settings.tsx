import { copy } from "@/components/dashboard/copy";
import { IntegrationsGroup } from "@/components/integrations";
import { HourFormatSelect } from "@/components/hour-format-select";
import { ThemeSelect } from "@/components/mode-toggle";
import { PushToggle } from "@/components/dashboard/push-toggle";
import { SettingsGroup, SettingsRow, settingsPage } from "@/components/settings-list";
import { TimeZoneSelect } from "@/components/time-zone-select";
import { WeekStartSelect } from "@/components/week-start-select";

export default function SettingsPage(): JSX.Element {
  return (
    <main className={settingsPage}>
      {/* sr-only: a sidebar e o title do Helmet já nomeiam a página na tela */}
      <h1 className="sr-only">{copy.profile.settingsPageTitle}</h1>

      <SettingsGroup title={copy.profile.groupAppearance}>
        <SettingsRow label={copy.profile.themeTitle}>
          <ThemeSelect />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title={copy.profile.groupDateTime}>
        <SettingsRow label={copy.profile.timeZoneTitle} hint={copy.profile.timeZoneDescription}>
          <TimeZoneSelect />
        </SettingsRow>
        <SettingsRow label={copy.profile.hourFormatTitle}>
          <HourFormatSelect />
        </SettingsRow>
        <SettingsRow label={copy.profile.weekStartTitle} hint={copy.profile.weekStartDescription}>
          <WeekStartSelect />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title={copy.profile.notificationsTitle}>
        <SettingsRow label={copy.profile.pushTitle} hint={copy.form.notificationsOff}>
          <PushToggle />
        </SettingsRow>
      </SettingsGroup>

      <IntegrationsGroup />
    </main>
  );
}
