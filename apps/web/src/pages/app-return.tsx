import { useEffect, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useLocation } from "react-router-dom";

import { AuthShell } from "@/components/auth/auth-shell";
import { copy } from "@/components/auth/copy";
import { Button } from "@/components/ui/button";

/**
 * `/app/<path>`: where Stripe sends someone who paid from the app. With the app installed the
 * system usually opens it first (App Link); otherwise this page hands `<path>` to `mewki://open`.
 */
export default function AppReturn() {
  const { pathname, search } = useLocation();
  const path = pathname.slice("/app".length) || "/dashboard";
  const deepLink = `mewki://open${path}${search}`;

  // One try only (StrictMode runs effects twice): repeating stacks system dialogs.
  const tried = useRef(false);
  useEffect(() => {
    if (tried.current) return;
    tried.current = true;
    window.location.href = deepLink;
  }, [deepLink]);

  return (
    <AuthShell>
      <Helmet>
        <title>{copy.appReturn.pageTitle}</title>
      </Helmet>
      <div className="flex flex-col items-center gap-4 pt-24 text-center">
        <p className="text-body text-ink">{copy.appReturn.message}</p>
        <Button asChild size="lg" className="w-full">
          <a href={deepLink}>{copy.appReturn.open}</a>
        </Button>
        <Button asChild size="lg" variant="secondary" className="w-full">
          <Link to={`${path}${search}`}>{copy.appReturn.browser}</Link>
        </Button>
      </div>
    </AuthShell>
  );
}
