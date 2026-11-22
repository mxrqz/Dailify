const RANGE = "https://api.pwnedpasswords.com/range/";
const TIMEOUT_MS = 5_000;

/**
 * Whether Have I Been Pwned lists the password, by k-anonymity: only the first 5 hex chars of its
 * SHA-1 leave the Worker. Better Auth's `haveIBeenPwned` plugin does the same but sets no timeout.
 * Throws when the service fails, so the caller fails closed.
 */
export async function isPwned(password: string): Promise<boolean> {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(password));
  const hex = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  const res = await fetch(RANGE + hex.slice(0, 5), {
    // Padding rows (count 0) hide how many real suffixes share the prefix.
    headers: { "Add-Padding": "true" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`pwnedpasswords answered ${res.status}`);
  const suffix = hex.slice(5);
  return (await res.text()).split("\n").some((line) => {
    const [rest, count] = line.trim().split(":");
    return rest === suffix && Number(count) > 0;
  });
}
