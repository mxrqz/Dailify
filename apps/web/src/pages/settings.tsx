import { copy } from "@/components/dashboard/copy";
import { IntegrationsSummary } from "@/components/integrations";
import { HourFormatSelect } from "@/components/hour-format-select";
import { ListGroup, ListRow } from "@/components/kit/list";
import { PageHeader } from "@/components/kit/page-header";
import { ThemeSelect } from "@/components/theme-select";
import { PushToggle } from "@/components/push-toggle";
import { accountGroups, accountPage } from "@/components/settings-list";
import { TimeZoneSelect } from "@/components/time-zone-select";
import { WeekStartSelect } from "@/components/week-start-select";

export default function SettingsPage(): JSX.Element {
  return (
    <main className={accountPage}>
      <PageHeader title={copy.profile.settingsPageTitle} className="px-1" />

      <div className={accountGroups}>
        <ListGroup title={copy.profile.groupAppearance}>
          <ListRow label={copy.profile.themeTitle} below={<ThemeSelect />} />
        </ListGroup>

        <ListGroup title={copy.profile.groupDateTime} footer={copy.profile.weekStartDescription}>
          <TimeZoneSelect />
          <ListRow label={copy.profile.hourFormatTitle} trailing={<HourFormatSelect />} />
          <ListRow label={copy.profile.weekStartTitle} below={<WeekStartSelect />} />
        </ListGroup>

        <ListGroup title={copy.profile.notificationsTitle} footer={copy.form.notificationsOff}>
          <PushToggle />
        </ListGroup>

        <IntegrationsSummary />
      </div>
    </main>
  );
}
