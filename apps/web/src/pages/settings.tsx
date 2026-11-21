import { CircleHelpIcon, MicIcon } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";

import { copy } from "@/components/dashboard/copy";
import { IntegrationsSummary } from "@/components/integrations";
import { HourFormatSelect } from "@/components/hour-format-select";
import { ListGroup, ListRow } from "@/components/kit/list";
import { PageHeader } from "@/components/kit/page-header";
import { ONBOARDING_KEY } from "@/components/onboarding/onboarding";
import { ThemeSelect } from "@/components/theme-select";
import { PushToggle } from "@/components/push-toggle";
import { accountGroups, accountPage } from "@/components/settings-list";
import { TimeZoneSelect } from "@/components/time-zone-select";
import { WeekStartSelect } from "@/components/week-start-select";
import { useStoredFlag } from "@/hooks/useStoredFlag";
import { nativeReminders, openAssistantSettings } from "@/lib/reminders";

export default function SettingsPage(): JSX.Element {
  const navigate = useNavigate();
  const [, setIntroSeen] = useStoredFlag(ONBOARDING_KEY);

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

        {nativeReminders() && (
          <ListGroup title={copy.profile.groupAssistant} footer={copy.profile.assistantFooter}>
            <ListRow
              icon={<MicIcon />}
              label={copy.profile.assistantTitle}
              accessory="chevron"
              onClick={() => void openAssistantSettings().catch(() => undefined)}
            />
          </ListGroup>
        )}

        <IntegrationsSummary />

        <ListGroup title={copy.profile.groupHelp}>
          <ListRow
            icon={<CircleHelpIcon />}
            label={copy.profile.replayIntro}
            accessory="chevron"
            onClick={() => {
              setIntroSeen(false);
              navigate("/dashboard");
            }}
          />
        </ListGroup>
      </div>
    </main>
  );
}
