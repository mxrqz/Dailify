import { readLastUser } from "@/functions/offline";
import { useSession } from "@/lib/auth";

/**
 * The signed-in user. A network or 5xx get-session error isn't signing out (the boot gate paints
 * the cache), so then it is the last user who was signed in; only a 401 means nobody.
 */
export function useUser() {
  const { data, error } = useSession();
  if (data?.user) return data.user;
  return error && error.status !== 401 ? readLastUser() : undefined;
}
