import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

import { classifyAuthError, type AuthFailure } from "@/components/auth/auth-state";
import { AuthShell } from "@/components/auth/auth-shell";
import { copy } from "@/components/auth/copy";
import { EmailForm } from "@/components/auth/email-form";
import { useTurnstile } from "@/components/auth/turnstile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient, settle } from "@/lib/auth";
import { formString } from "@/lib/form";

type Status = "form" | "busy" | "sent" | "done" | "invalid";

/**
 * `/reset-password`: without a token it asks for the e-mailed link; the link lands here as
 * `#token=…`, kept out of every server log, and the token is spent only on submit.
 */
export default function ResetPassword() {
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get("token"));
  const [status, setStatus] = useState<Status>("form");
  const [failure, setFailure] = useState<AuthFailure>();
  const { ref: captchaRef, token: captchaToken } = useTurnstile();

  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(window.history.state, "", window.location.pathname);
    }
  }, []);

  const request = async (email: string) => {
    setStatus("busy");
    const headers = { "x-captcha-response": await captchaToken() };
    const { error } = await settle(
      authClient.requestPasswordReset({ email, fetchOptions: { headers } }),
    );
    setFailure(error ? classifyAuthError(error) : undefined);
    setStatus(error ? "form" : "sent");
  };

  const reset = async (newPassword: string) => {
    if (!token) return;
    setStatus("busy");
    const { error } = await settle(authClient.resetPassword({ newPassword, token }));
    if (!error) return setStatus("done");
    // A spent or expired token answers INVALID_TOKEN: only a new e-mail helps.
    if (error.code === "INVALID_TOKEN") return setStatus("invalid");
    setFailure(classifyAuthError(error));
    setStatus("form");
  };

  const message =
    status === "sent"
      ? copy.reset.sent
      : status === "done"
        ? copy.reset.done
        : status === "invalid"
          ? copy.reset.invalid
          : undefined;

  return (
    <AuthShell
      title={token ? copy.reset.newTitle : copy.reset.title}
      subtitle={token ? undefined : copy.reset.subtitle}
    >
      <Helmet>
        <title>{copy.reset.pageTitle}</title>
      </Helmet>
      {message ? (
        <>
          <p role="status" className="text-center text-body text-ink">
            {message}
          </p>
          <Button asChild size="lg" variant="secondary">
            <Link to={status === "invalid" ? "/reset-password" : "/login"}>
              {status === "invalid" ? copy.reset.request : copy.reset.toLogin}
            </Link>
          </Button>
        </>
      ) : token ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void reset(formString(new FormData(e.currentTarget), "password"));
          }}
        >
          <label htmlFor="password" className="px-1 text-subhead font-medium text-ink-secondary">
            {copy.reset.newLabel}
          </label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={10}
            maxLength={128}
            autoComplete="new-password"
            aria-invalid={failure !== undefined}
            aria-describedby="password-hint"
            className="h-13 rounded-md border-0 bg-fill px-4 text-body shadow-none md:text-body"
          />
          <p id="password-hint" role={failure ? "alert" : undefined} className="px-1 text-footnote">
            {failure ? copy.errors[failure.key] : copy.shell.newPasswordHint}
          </p>
          <Button type="submit" size="lg" loading={status === "busy"}>
            {copy.reset.submit}
          </Button>
        </form>
      ) : (
        <EmailForm
          onSubmit={(email) => void request(email)}
          disabled={status === "busy"}
          submitLabel={copy.reset.request}
          failure={failure}
        />
      )}
      <div ref={captchaRef} />
    </AuthShell>
  );
}
