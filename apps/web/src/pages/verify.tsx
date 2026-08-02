import { CheckIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { useEffect, useState } from "react";

export default function Verify() {
  const [closeCountDown, setCloseCountDown] = useState<number>(5);

  useEffect(() => {
    if (closeCountDown <= 0) {
      window.close();
      return;
    }

    const interval = setInterval(() => {
      setCloseCountDown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [closeCountDown]);

  return (
    <div className="w-full h-dvh flex flex-col justify-center items-center py-5 px-[clamp(1rem,5vw,6rem)]">
      <Card className="w-full md:max-w-1/2 text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-primary/10 p-6">
              <CheckIcon className="h-12 w-12 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Authentication Successful</CardTitle>
          <CardDescription className="text-center">
            You have been successfully logged in
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            You can now close this tab and return to the application.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
