import { ChevronLeftIcon } from "lucide-react";
import { Link } from "react-router-dom";

import { copy } from "@/components/dashboard/copy";
import { Integrations } from "@/components/integrations";
import { PageHeader } from "@/components/kit/page-header";
import { accountGroups, accountPage } from "@/components/settings-list";

const t = copy.integrations;

export default function IntegrationsPage(): JSX.Element {
  return (
    <main className={accountPage}>
      {/* Volta pra /settings, de onde se chega aqui; não é a barra do app, então não gruda. */}
      <Link
        to="/settings"
        className="-ml-1 inline-flex h-11 w-fit items-center gap-0.5 rounded-sm pr-2.5 text-body text-ink hover:bg-fill [&_svg]:size-6"
      >
        <ChevronLeftIcon aria-hidden="true" />
        {t.back}
      </Link>
      <PageHeader title={t.group} subtitle={t.lead} className="px-1" />

      <div className={accountGroups}>
        <Integrations />
      </div>
    </main>
  );
}
