import { copy } from "@/components/auth/copy";
import { GoogleLogo } from "@/components/logos";
import { Button } from "@/components/ui/button";

export function OAuthButtons({
  onGoogle,
  disabled,
}: {
  onGoogle: () => void;
  disabled: boolean;
}): JSX.Element {
  return (
    <>
      <div className="my-2 flex items-center gap-3 text-footnote text-ink-secondary before:h-px before:flex-1 before:bg-separator after:h-px after:flex-1 after:bg-separator">
        {copy.shell.dividerOr}
      </div>

      <Button type="button" size="lg" variant="secondary" onClick={onGoogle} disabled={disabled}>
        <GoogleLogo className="fill-current" />
        {copy.shell.continueWithGoogle}
      </Button>
    </>
  );
}
