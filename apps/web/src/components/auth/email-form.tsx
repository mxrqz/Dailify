import { ArrowRightIcon, Loader2Icon } from "lucide-react";
import { Link } from "react-router-dom";

import type { AuthFailure } from "@/components/auth/auth-state";
import { copy } from "@/components/auth/copy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formString } from "@/lib/form";

/** A oferta é um erro que vira convite: o e-mail existe (ou não) na tela errada. */
function Offer({ mode }: { mode: "signIn" | "signUp" }): JSX.Element {
  const isSignUp = mode === "signUp";
  return (
    <p className="text-sm text-muted-foreground">
      {isSignUp ? copy.errors.offerSignUp : copy.errors.offerSignIn}{" "}
      <Link
        to={isSignUp ? "/signup" : "/login"}
        className="text-primary underline-offset-4 hover:underline"
      >
        {isSignUp ? copy.errors.offerSignUpAction : copy.errors.offerSignInAction}
      </Link>
    </p>
  );
}

export function EmailForm({
  onSubmit,
  disabled,
  submitLabel,
  failure,
  defaultEmail,
}: {
  onSubmit: (email: string) => void;
  disabled: boolean;
  submitLabel: string;
  failure?: AuthFailure;
  /** Preenchido quando já sabemos o e-mail (link vencido): o retry vira um clique só. */
  defaultEmail?: string;
}): JSX.Element {
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(formString(new FormData(e.currentTarget), "email"));
      }}
    >
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="email"
          className="font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground"
        >
          {copy.shell.emailLabel}
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={defaultEmail}
          placeholder={copy.shell.emailPlaceholder}
          aria-invalid={failure?.kind === "message"}
          aria-describedby={failure?.kind === "message" ? "email-error" : undefined}
        />
      </div>

      {failure?.kind === "message" && (
        <p id="email-error" className="text-sm text-destructive">
          {copy.errors[failure.key]}
          {failure.code && (
            <span className="ml-1 font-mono text-2xs uppercase tracking-[0.04em] opacity-70">
              {failure.code}
            </span>
          )}
        </p>
      )}

      {failure?.kind === "offer" && <Offer mode={failure.mode} />}

      <Button type="submit" disabled={disabled}>
        {disabled ? <Loader2Icon className="animate-spin" /> : null}
        {submitLabel}
        {disabled ? null : <ArrowRightIcon />}
      </Button>
    </form>
  );
}
