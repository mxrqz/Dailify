import { copy } from "@/components/auth/copy";
import { MfaChallenge, useSecondFactor } from "@/components/auth/mfa-challenge";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useStepUp } from "@/hooks/useStepUp";

// Inside the content, so each opening starts on a blank challenge.
function StepUpBody({ onVerified }: { onVerified: () => void }): JSX.Element {
  return <MfaChallenge {...useSecondFactor(onVerified)} showTrust={false} />;
}

/** The second factor before a sensitive action (`withStepUp`); mounted once, in App. */
export function StepUpDialog(): JSX.Element {
  const { open, finish } = useStepUp();
  return (
    <Dialog open={open} onOpenChange={(next) => !next && finish(false)}>
      <DialogContent>
        <DialogTitle className="sr-only">{copy.mfa.title}</DialogTitle>
        <DialogDescription>{copy.mfa.stepUp}</DialogDescription>
        <StepUpBody onVerified={() => finish(true)} />
      </DialogContent>
    </Dialog>
  );
}
