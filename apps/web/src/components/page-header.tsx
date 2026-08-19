import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { copy } from "@/components/dashboard/copy";
import { Button } from "@/components/ui/button";

export function PageHeader({ title }: { title: string }): JSX.Element {
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
        <ChevronLeft className="h-4 w-4" />
        <span className="sr-only">{copy.profile.back}</span>
      </Button>
      <h1 className="text-2xl font-semibold tracking-[-0.01em]">{title}</h1>
    </div>
  );
}
