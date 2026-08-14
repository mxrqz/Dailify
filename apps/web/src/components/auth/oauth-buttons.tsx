import { copy } from "@/components/auth/copy";
import { GoogleLogo } from "@/components/logos";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function OAuthButtons({
  onGoogle,
  disabled,
}: {
  onGoogle: () => void;
  disabled: boolean;
}): JSX.Element {
  return (
    <>
      <div className="inline-flex items-center gap-3">
        <Separator className="shrink" />
        <span className="font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground">
          {copy.shell.dividerOr}
        </span>
        <Separator className="shrink" />
      </div>

      <Button type="button" variant="outline" onClick={onGoogle} disabled={disabled}>
        <GoogleLogo className="fill-foreground" />
        {copy.shell.continueWithGoogle}
      </Button>
    </>
  );
}
