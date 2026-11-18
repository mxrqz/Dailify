/** Which shell runs the page, and the same-site path guard. No imports: anything can depend on it. */
export const isTauri = (): boolean => Reflect.get(globalThis, "isTauri") === true;

// The app has no landing page: signing out lands on the login screen.
export const signedOutPath = (): string => (isTauri() ? "/login" : "/");

/**
 * Só caminho interno. `//evil.com` (e `/\evil.com`, que o navegador normaliza pro mesmo) é
 * protocol-relative: sairia do site pelo `<Navigate>` e pelo `callbackURL` do Better Auth.
 */
export function internalPath(path: string | null | undefined): string {
  if (!path?.startsWith("/") || path.startsWith("//") || path.startsWith("/\\"))
    return "/dashboard";
  return path;
}
