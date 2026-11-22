import { Link } from "react-router-dom";

import type { AuthFailure } from "@/components/auth/auth-state";
import { copy } from "@/components/auth/copy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formString } from "@/lib/form";

const FIELD =
  "h-13 rounded-md border-0 bg-fill px-4 text-body shadow-none placeholder:text-ink-tertiary md:text-body";
const LABEL = "px-1 text-subhead font-medium text-ink-secondary";
const PASSWORD_ERRORS: readonly string[] = [
  "wrongPassword",
  "passwordRules",
  "passwordCompromised",
];

export function EmailForm({
  onSubmit,
  disabled,
  submitLabel,
  failure,
  defaultEmail,
  onEmailChange,
  password,
  forgotTo,
  webauthn,
}: {
  onSubmit: (email: string, password: string) => void;
  onEmailChange?: (email: string) => void;
  disabled: boolean;
  submitLabel: string;
  failure?: AuthFailure;
  /** Preenchido quando já sabemos o e-mail (reenvio que falhou): o retry vira um clique só. */
  defaultEmail?: string;
  /** Adds the password field: the saved one at sign-in, a new one at sign-up. */
  password?: "current-password" | "new-password";
  /** The "Esqueci a senha" link, beside a current password. */
  forgotTo?: string;
  /** The browser offers saved passkeys on the e-mail field (conditional UI). */
  webauthn?: boolean;
}): JSX.Element {
  // Só erro sobre o VALOR marca o campo como inválido; rede, captcha e rate limit não são problema
  // do que foi digitado. Descrever o erro (aria-describedby) segue valendo pra todos.
  const invalidValue = failure?.key === "invalidEmail";
  const invalidPassword = failure !== undefined && PASSWORD_ERRORS.includes(failure.key);
  const described = failure ? "email-error" : undefined;

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        onSubmit(formString(data, "email"), formString(data, "password"));
      }}
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className={LABEL}>
          {copy.shell.emailLabel}
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete={webauthn ? "username webauthn" : password ? "username" : "email"}
          defaultValue={defaultEmail}
          onChange={(e) => onEmailChange?.(e.target.value)}
          placeholder={copy.shell.emailPlaceholder}
          className={FIELD}
          aria-invalid={invalidValue}
          aria-describedby={described}
        />
      </div>

      {password && (
        <div className="flex flex-col gap-2">
          <label htmlFor="password" className={LABEL}>
            {copy.shell.passwordLabel}
          </label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={password === "new-password" ? 10 : undefined}
            maxLength={128}
            autoComplete={password}
            className={FIELD}
            aria-invalid={invalidPassword}
            aria-describedby={password === "new-password" ? "password-hint" : described}
          />
          {password === "new-password" && (
            <p id="password-hint" className="px-1 text-footnote text-ink-secondary">
              {copy.shell.newPasswordHint}
            </p>
          )}
        </div>
      )}

      {failure && (
        <p id="email-error" className="px-1 text-subhead text-brand-text">
          {copy.errors[failure.key]}
          {failure.code && <span className="ml-1 caps opacity-70">{failure.code}</span>}
        </p>
      )}

      {forgotTo && (
        <Link
          to={forgotTo}
          className="flex h-11 items-center self-end px-1 text-subhead font-medium text-brand-text"
        >
          {copy.shell.forgotPassword}
        </Link>
      )}

      <Button type="submit" size="lg" loading={disabled}>
        {submitLabel}
      </Button>
    </form>
  );
}
