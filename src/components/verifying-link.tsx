import { ArrowLeft, MailIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";

export default function VerifyingLink({
  email,
  onAction,
}: {
  email: string;
  onAction: (action: string) => void;
}) {
  return (
    <Card className="w-full md:max-w-1/2 text-center">
      <CardHeader>
        <div className="flex justify-center mb-4">
          <div className="rounded-full bg-primary/10 p-6">
            <MailIcon className="h-12 w-12 text-primary" />
          </div>
        </div>
        <CardTitle className="text-2xl">Check your email</CardTitle>
        <CardDescription className="text-center">
          We've sent a magic link to
          <div className="font-medium text-foreground mt-1">{email}</div>
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">
          Click the link we sent to your email to sign in to your Schedule. The link is valid for 10
          minutes.
        </p>
      </CardContent>

      <CardFooter className="flex flex-col space-y-2">
        {/* <Button variant="outline" className="w-full gap-2">
                    <RotateCw className="h-4 w-4" />
                    Resend link
                </Button> */}

        <Button
          variant="secondary"
          className="w-full gap-2 cursor-pointer"
          onClick={() => onAction("back")}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to login
        </Button>
      </CardFooter>
    </Card>
  );
}
