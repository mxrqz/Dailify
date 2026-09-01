import { ListTodoIcon, RepeatIcon, SparklesIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { QUOTA_KEYS, type QuotaKey } from "@dailify/shared";

import { copy } from "@/components/dashboard/copy";
import { Progress } from "@/components/ui/progress";
import { quotaLabel } from "@/functions/quota-label";
import { useQuotas } from "@/hooks/useQuotas";
import { cn } from "@/lib/utils";

/** Um ícone por quota — quota nova sem ícone não compila. */
const ICONS: Record<QuotaKey, typeof ListTodoIcon> = {
  tasks: ListTodoIcon,
  recurring: RepeatIcon,
  voice: SparklesIcon,
};

/**
 * As três quotas na barra do app. `ratio === null` (ilimitado) vira `value={null}` no Radix, que
 * deixa o trilho vazio: não existe fração de um teto que não existe, e desenhar 0% ou 100% mentiria.
 */
export function QuotaBar(): JSX.Element | null {
  const quotas = useQuotas();
  if (quotas.loading) return null;

  return (
    <div className="hidden items-center gap-3 md:flex">
      {QUOTA_KEYS.map((key) => {
        const state = quotas.states[key];
        const Icon = ICONS[key];
        const label = quotaLabel(state, copy.quota.names[key], copy.quota.unlimited);

        return (
          <Link
            key={key}
            to="/premium"
            title={label}
            aria-label={label}
            className="inline-flex items-center gap-1.5"
          >
            <Icon
              className={cn("size-3 text-muted-foreground", state.exhausted && "text-destructive")}
              aria-hidden="true"
            />
            <Progress
              value={state.ratio === null ? null : state.ratio * 100}
              className="h-1 w-8"
              aria-hidden="true"
            />
          </Link>
        );
      })}
    </div>
  );
}
