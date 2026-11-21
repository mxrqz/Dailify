import { ChevronLeftIcon } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { copy } from "@/components/dashboard/copy";
import { Button } from "@/components/ui/button";

/**
 * Barra de material com voltar e o título centrado (legal e, no mobile, as páginas de conta).
 * Voltar desfaz a navegação; sem entrada anterior no app (link direto), vai pra `fallback`.
 */
export function BackBar({ title, fallback }: { title: string; fallback: string }): JSX.Element {
  const navigate = useNavigate();
  // The router's first entry has key "default": nothing in the app to go back to.
  const isFirst = useLocation().key === "default";

  return (
    <nav className="sticky top-0 z-bar grid h-bar grid-cols-[2.75rem_1fr_2.75rem] items-center bg-material-bar-solid px-2">
      <Button
        variant="ghost"
        size="bar"
        aria-label={copy.legal.back}
        onClick={() => (isFirst ? navigate(fallback) : navigate(-1))}
      >
        <ChevronLeftIcon aria-hidden="true" />
      </Button>
      <span className="text-center text-subhead font-semibold">{title}</span>
    </nav>
  );
}
