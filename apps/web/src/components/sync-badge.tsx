import { useAuth } from "@clerk/clerk-react";
import { CloudOffIcon } from "lucide-react";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { pendingCount } from "@/functions/offline";
import { useOnline } from "@/hooks/useOnline";

/**
 * O aviso de que o app está guardando escritas em vez de mandá-las. Sem ele o offline é silencioso
 * — e silêncio, aqui, é indistinguível de "salvou".
 *
 * Relê a fila quando `tasks` muda: toda mutação passa por lá, então é o gatilho que já existe.
 */
export function SyncBadge(): JSX.Element | null {
  const online = useOnline();
  const { userId } = useAuth();
  const { tasks } = useDailify();

  if (!userId) return null;

  const pending = tasks ? pendingCount(userId) : 0;
  if (online && pending === 0) return null;

  const label = pending
    ? pending === 1
      ? copy.sync.onePending
      : copy.sync.manyPending.replace("{n}", String(pending))
    : copy.sync.offline;

  return (
    <span
      className="inline-flex h-6 items-center gap-1.5 rounded-full border border-surface-line px-2 font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground"
      title={copy.sync.offline}
    >
      <CloudOffIcon className="size-3" aria-hidden="true" />
      {label}
    </span>
  );
}
