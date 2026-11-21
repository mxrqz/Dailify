import { Helmet } from "react-helmet-async";

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
import { nativeReminders } from "@/lib/reminders";

export default function SettingsPage(): JSX.Element {
  return (
    <main className={accountPage}>
      <Helmet>
        <title>{copy.pageTitle.settings}</title>
      </Helmet>
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

        {/* ponytail: text only; a button needs a native command opening ACTION_VOICE_INPUT_SETTINGS. */}
        {nativeReminders() && (
          <ListGroup title={copy.profile.groupAssistant} footer={copy.profile.assistantFooter}>
            <ListRow label={copy.profile.assistantTitle} sublabel={copy.profile.assistantPath} />
          </ListGroup>
        )}

        <IntegrationsSummary />
      </div>
    </main>
  );
}
