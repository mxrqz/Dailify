import { CloudOffIcon, CloudUploadIcon } from "lucide-react";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { fill } from "@/functions/functions";
import { pendingCount } from "@/functions/offline";
import { useOnline } from "@/hooks/useOnline";
import { useSession } from "@/lib/auth";

/**
 * O aviso de que o app está guardando escritas em vez de mandá-las. Sem ele o offline é silencioso
 * — e silêncio, aqui, é indistinguível de "salvou".
 *
 * Relê a fila quando `tasks` muda: toda mutação passa por lá, então é o gatilho que já existe.
 */
export function SyncBadge(): JSX.Element | null {
  const online = useOnline();
  const userId = useSession().data?.user.id;
  const { tasks } = useDailify();

  if (!userId) return null;

  const pending = tasks ? pendingCount(userId) : 0;
  if (online && pending === 0) return null;

  const label = pending
    ? pending === 1
      ? copy.sync.onePending
      : fill(copy.sync.manyPending, { n: pending })
    : copy.sync.offline;

  // Online with a queue (e.g. writes held after a 401) is not "offline".
  const Icon = online ? CloudUploadIcon : CloudOffIcon;

  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-sm bg-fill px-2 text-xs font-medium text-ink-secondary">
      <Icon className="size-3" aria-hidden="true" />
      {label}
    </span>
  );
}
