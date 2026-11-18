import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";

/** Tries a `mewki://` link once: StrictMode runs effects twice, and repeating stacks system dialogs. */
export function useOpenOnce(url: string | null | undefined): void {
  const tried = useRef(false);
  useEffect(() => {
    if (!url || tried.current) return;
    tried.current = true;
    window.location.href = url;
  }, [url]);
}

/** The body of the hand-off pages: a message, the app link (when there is one), the browser way. */
export function HandoffNotice({
  message,
  open,
  browser,
  children,
}: {
  message: string;
  open?: { href: string; label: string };
  browser: { to: string; label: string };
  children?: ReactNode;
}): JSX.Element {
  return (
    <AuthShell>
      {children}
      <div className="flex flex-col items-center gap-4 pt-24 text-center">
        <p className="text-body text-ink">{message}</p>
        {open && (
          <Button asChild size="lg" className="w-full">
            <a href={open.href}>{open.label}</a>
          </Button>
        )}
        <Button asChild size="lg" variant="secondary" className="w-full">
          <Link to={browser.to}>{browser.label}</Link>
        </Button>
      </div>
    </AuthShell>
  );
}
