import type { AuthFailure } from "@/components/auth/auth-state";
import { copy } from "@/components/auth/copy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formString } from "@/lib/form";

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
  /** Preenchido quando já sabemos o e-mail (reenvio que falhou): o retry vira um clique só. */
  defaultEmail?: string;
}): JSX.Element {
  // Só erro sobre o VALOR marca o campo como inválido; rede, captcha e rate limit não são problema
  // do que foi digitado. Descrever o erro (aria-describedby) segue valendo pra todos.
  const invalidValue = failure?.key === "invalidEmail";

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(formString(new FormData(e.currentTarget), "email"));
      }}
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="px-1 text-subhead font-medium text-ink-secondary">
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
          className="h-13 rounded-md border-0 bg-fill px-4 text-body shadow-none placeholder:text-ink-tertiary md:text-body"
          aria-invalid={invalidValue}
          aria-describedby={failure ? "email-error" : undefined}
        />
      </div>

      {failure && (
        <p id="email-error" className="px-1 text-subhead text-brand-text">
          {copy.errors[failure.key]}
          {failure.code && <span className="ml-1 caps opacity-70">{failure.code}</span>}
        </p>
      )}

      <Button type="submit" size="lg" loading={disabled}>
        {submitLabel}
      </Button>
    </form>
  );
}
