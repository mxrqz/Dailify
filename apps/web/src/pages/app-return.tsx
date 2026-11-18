import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";

import { copy } from "@/components/auth/copy";
import { HandoffNotice, useOpenOnce } from "@/components/auth/handoff";
import { internalPath } from "@/lib/platform";

/**
 * `/app/<path>`: where Stripe sends someone who paid from the app. With the app installed the
 * system usually opens it first (App Link); otherwise this page hands `<path>` to `mewki://open`.
 */
export default function AppReturn() {
  const { pathname, search } = useLocation();
  // `/app//evil.com` still matches `/app/*`, and a `Link` to `//evil.com` leaves the site.
  const path = internalPath(pathname.slice("/app".length) || "/dashboard");
  const deepLink = `mewki://open${path}${search}`;
  useOpenOnce(deepLink);

  return (
    <HandoffNotice
      message={copy.appReturn.message}
      open={{ href: deepLink, label: copy.appReturn.open }}
      browser={{ to: `${path}${search}`, label: copy.appReturn.browser }}
    >
      <Helmet>
        <title>{copy.appReturn.pageTitle}</title>
      </Helmet>
    </HandoffNotice>
  );
}
