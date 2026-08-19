import { ChevronLeft } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { PersonalTab, SecurityTab, SubscriptionTab } from "@/components/profileTabs";
import { Button } from "@/components/ui/button";

type Section = "personal" | "security" | "premium";

const SECTIONS: readonly string[] = ["personal", "security", "premium"];
const isSection = (value: string | null): value is Section =>
  value !== null && SECTIONS.includes(value);

export default function ProfilePage() {
  const navigate = useNavigate();
  const { invoices, permissions, paymentDetails } = useDailify();

  const [searchParams] = useSearchParams();
  const tab = searchParams.get("tab");
  const active: Section = isSection(tab) ? tab : "personal";

  return (
    <main className="flex w-full flex-col gap-6 py-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
          <ChevronLeft className="h-4 w-4" />
          <span className="sr-only">{copy.profile.back}</span>
        </Button>
        <h1 className="text-2xl font-semibold tracking-[-0.01em]">{copy.profile.pageTitle}</h1>
      </div>

      <div className="flex flex-col gap-6">
        {active === "personal" && <PersonalTab />}

        {active === "security" && <SecurityTab />}

        {active === "premium" && permissions && paymentDetails && invoices && (
          <SubscriptionTab
            invoices={invoices}
            paymentDetails={paymentDetails}
            permissions={permissions}
          />
        )}
      </div>
    </main>
  );
}
