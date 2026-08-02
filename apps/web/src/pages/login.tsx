import { ArrowRightIcon, Loader2Icon } from "lucide-react";
import { AppleLogo, GoogleLogo } from "../components/logos";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Separator } from "../components/ui/separator";
import { useState } from "react";
import { useAuth, useSignIn, useSignUp, useUser } from "@clerk/clerk-react";
import { EmailLinkFactor } from "@clerk/types";
import { ClerkAPIError, OAuthStrategy } from "@clerk/types";
import VerifyingLink from "../components/verifying-link";
import { isClerkAPIResponseError } from "@clerk/clerk-react/errors";
import { useLocation } from "react-router-dom";
import { dailifyURL } from "@/consts/conts";
import { auth } from "@/functions/firebase";
import { signOut } from "firebase/auth";

export default function Login() {
  const { signOut: clerkSignOut } = useAuth();
  const { signIn, isLoaded } = useSignIn();
  const { signUp } = useSignUp();
  const { isSignedIn } = useUser();

  const location = useLocation();
  const state = location.state as { from?: { pathname?: string; search?: string } } | null;
  const from = (state?.from?.pathname ?? "") + (state?.from?.search ?? "") || "/dashboard";

  const [verifying, setVerifying] = useState(false);
  const [email, setEmail] = useState<string>("");

  const signInWith = (strategy: OAuthStrategy) => {
    if (!signIn) return null;

    return signIn
      .authenticateWithRedirect({
        strategy,
        redirectUrl: "/login/sso-callback",
        redirectUrlComplete: from,
      })
      .catch((err: ClerkAPIError) => {
        console.error(err.message);
      });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isLoaded || !signUp) return;

    setVerifying(true);

    const formData = new FormData(e.currentTarget);
    const emailAddress = formData.get("email") as string;
    setEmail(emailAddress);
    const { startEmailLinkFlow } = signUp.createEmailLinkFlow();

    const url = dailifyURL;
    const redirectUrl = `${url}/sign-in/verify`;

    try {
      const { supportedFirstFactors } = await signIn.create({ identifier: emailAddress });

      const emailLinkFactor = supportedFirstFactors?.find(
        (factor): factor is EmailLinkFactor => factor.strategy === "email_link",
      );

      if (!emailLinkFactor) {
        return;
      }

      const signInAttempt = await signIn.createEmailLinkFlow().startEmailLinkFlow({
        emailAddressId: emailLinkFactor.emailAddressId,
        redirectUrl,
      });

      if (signInAttempt.firstFactorVerification.status === "verified") {
        window.location.href = from;
      }
    } catch (err) {
      if (isClerkAPIResponseError(err)) {
        if (err.errors[0].code === "form_identifier_not_found") {
          await signUp.create({
            emailAddress,
            unsafeMetadata: {
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
          });

          const signUpAttempt = await startEmailLinkFlow({
            redirectUrl,
          });

          const verification = signUpAttempt.verifications.emailAddress;

          if (verification.status === "verified") {
            window.location.href = "/";
          }
        } else {
          console.error("Unexpected error:", err);
        }
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleAction = (action: string) => {
    if (action === "back") {
      setVerifying(false);
      setEmail("");
    }
  };

  if (!isLoaded) {
    return (
      <div className="w-full h-dvh grid place-items-center bg-background">
        <Loader2Icon className="size-12 text-foreground animate-spin" />
      </div>
    );
  }

  const handleLogout = async () => {
    await clerkSignOut();
    await signOut(auth);
  };
  return (
    <div className="w-full h-dvh flex flex-col justify-center items-center py-5 px-[clamp(1rem,5vw,6rem)]">
      {verifying && email ? (
        <VerifyingLink email={email} onAction={handleAction} />
      ) : (
        <Card className="w-full md:max-w-1/2">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">Welcome to Dailify</CardTitle>
            <CardDescription className="text-center">Login to continue</CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-3">
            <div className="w-full flex gap-3">
              <Button
                className="w-full flex-1 bg-foreground text-background cursor-pointer hover:bg-foreground/90"
                onClick={() => signInWith("oauth_apple")}
              >
                <AppleLogo className="fill-background" />
                Apple
              </Button>

              <Button
                className="w-full flex-1 bg-foreground text-background cursor-pointer hover:bg-foreground/90"
                onClick={() => signInWith("oauth_google")}
              >
                <GoogleLogo className="fill-background" />
                Google
              </Button>
            </div>

            <div className="inline-flex items-center gap-3">
              <Separator className="shrink" />
              <span>or</span>
              <Separator className="shrink" />
            </div>

            <form className="w-full flex flex-col gap-3" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-1">
                <Label htmlFor="email">Email</Label>
                <Input type="email" id="email" name="email" />
              </div>

              <Button
                className="hover:[&_svg]:translate-x-2 [&_svg]:transition-transform cursor-pointer"
                type="submit"
              >
                Login
                <ArrowRightIcon />
              </Button>
            </form>

            {isSignedIn && (
              <Button variant={"destructive"} onClick={handleLogout}>
                Logout
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <div id="clerk-captcha" />
    </div>
  );
}
