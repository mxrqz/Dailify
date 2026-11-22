import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { KeyRoundIcon, MonitorIcon, SmartphoneIcon } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";
import { API_ERROR, isRecord, parseUserAgent } from "@dailify/shared";

import { classifyAuthError, type AuthFailure } from "@/components/auth/auth-state";
import { copy as authCopy } from "@/components/auth/copy";
import { MfaSetup, RecoveryCodes } from "@/components/auth/mfa-setup";
import { copy } from "@/components/dashboard/copy";
import { ListGroup, ListRow } from "@/components/kit/list";
import { PageHeader } from "@/components/kit/page-header";
import { Switch } from "@/components/kit/switch";
import { accountGroups, accountPage } from "@/components/settings-list";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setPassword } from "@/functions/api";
import { fill } from "@/functions/functions";
import { useEffectEvent } from "@/hooks/useEffectEvent";
import { withStepUp } from "@/hooks/useStepUp";
import { authClient, settle, useSession } from "@/lib/auth";
import { formString } from "@/lib/form";
import { signOutAndReload, verifySecondFactor } from "@/lib/native-auth";
import { openExternal } from "@/lib/open-external";
import { passkeysHere } from "@/lib/passkey";
import { isTauri } from "@/lib/platform";

type Session = typeof authClient.$Infer.Session.session;
type Account = { providerId: string; updatedAt: Date };
type Passkey = { id: string; name?: string | null; createdAt: Date };
type MfaAction = "enable" | "disable" | "codes";
type Open =
  | { kind: "password" }
  | { kind: "confirm"; action: MfaAction }
  | { kind: "setup"; uri: string; codes: string[] }
  | { kind: "codes"; codes: string[] }
  | { kind: "passkeys" }
  | { kind: "rename"; passkey: Passkey };

const FIELD = "h-12 rounded-md border-0 bg-fill px-4 text-body shadow-none md:text-body";

/** A Better Auth or `api.ts` error as the auth screens read it; a step-up the user closed is none. */
function failureOf(error: unknown): AuthFailure | null {
  if (error === null || typeof error !== "object") return null;
  const code = Reflect.get(error, "code");
  if (code === API_ERROR.mfaRequired) return null;
  if (Reflect.get(error, "offline") === true) return classifyAuthError(null);
  const status = Reflect.get(error, "status");
  return classifyAuthError({
    status: typeof status === "number" ? status : 0,
    code: typeof code === "string" ? code : undefined,
  });
}

/** Uma sessão: o aparelho, onde e quando, e "Este aparelho" ou o "Encerrar" vermelho suave. */
export function SessionRow({
  mobile,
  label,
  meta,
  current,
  onRevoke,
}: {
  mobile: boolean;
  label: string;
  meta: string;
  current: boolean;
  onRevoke: () => void;
}): JSX.Element {
  const Icon = mobile ? SmartphoneIcon : MonitorIcon;
  return (
    <ListRow
      icon={<Icon />}
      label={label}
      sublabel={meta}
      trailing={
        current ? (
          <span className="rounded-full bg-fill px-2.5 py-0.5 text-footnote font-medium whitespace-nowrap text-ink-secondary">
            {copy.profile.thisDevice}
          </span>
        ) : (
          <Button
            variant="soft-danger"
            size="sm"
            className="relative hit-target"
            onClick={onRevoke}
          >
            {copy.profile.revokeDevice}
          </Button>
        )
      }
    />
  );
}

/** A passkey: its name and age, with rename and remove. */
export function PasskeyRow({
  passkey,
  onRename,
  onRemove,
}: {
  passkey: Passkey;
  onRename: () => void;
  onRemove: () => void;
}): JSX.Element {
  const name = passkey.name || copy.profile.passkeyUnnamed;
  return (
    <ListRow
      icon={<KeyRoundIcon />}
      label={name}
      sublabel={fill(copy.profile.passkeyCreated, {
        when: formatDistanceToNow(passkey.createdAt, { addSuffix: true, locale: ptBR }),
      })}
      trailing={
        <span className="flex gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="relative hit-target"
            aria-label={fill(copy.profile.passkeyRename, { name })}
            onClick={onRename}
          >
            {copy.profile.passkeyRenameAction}
          </Button>
          <Button
            variant="soft-danger"
            size="sm"
            className="relative hit-target"
            aria-label={fill(copy.profile.passkeyRemove, { name })}
            onClick={onRemove}
          >
            {copy.profile.passkeyRemoveAction}
          </Button>
        </span>
      }
    />
  );
}

function ErrorLine({ failure }: { failure: AuthFailure | null }): JSX.Element | null {
  if (!failure) return null;
  return (
    <p role="alert" className="px-1 text-subhead text-brand-text">
      {authCopy.errors[failure.key]}
      {failure.code && <span className="ml-1 caps opacity-70">{failure.code}</span>}
    </p>
  );
}

export default function SecurityPage(): JSX.Element {
  const { data } = useSession();
  const currentId = data?.session.id;
  const mfaOn = Boolean(data?.user.twoFactorEnabled);
  const [sessions, setSessions] = useState<Session[]>();
  const [accounts, setAccounts] = useState<Account[]>();
  const [passkeys, setPasskeys] = useState<Passkey[]>();
  const [open, setOpen] = useState<Open | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<AuthFailure | null>(null);
  const credential = accounts?.find((a) => a.providerId === "credential");
  const hasPassword = credential !== undefined;

  const load = async () => {
    const [listed, linked, keys] = await Promise.all([
      settle(authClient.listSessions()),
      settle(authClient.listAccounts()),
      passkeysHere() ? settle(authClient.passkey.listUserPasskeys()) : null,
    ]);
    if (listed.error) toast.error(copy.profile.sessionsError);
    if (listed.data) setSessions(listed.data);
    if (linked.data) setAccounts(linked.data);
    if (keys?.data) setPasskeys(keys.data);
  };

  // Uma vez ao abrir; depois, só o revogar relê.
  const loadOnOpen = useEffectEvent(load);
  useEffect(() => {
    void loadOnOpen();
  }, []);

  const show = (next: Open | null) => {
    setOpen(next);
    setFailure(null);
  };

  const revoke = async (token: string) => {
    const { error } = await settle(authClient.revokeSession({ token }));
    if (error) toast.error(copy.profile.revokeError);
    await load();
  };

  const revokeOthers = async () => {
    const { error } = await settle(authClient.revokeOtherSessions());
    if (error) toast.error(copy.profile.revokeError);
    await load();
  };

  // Runs a step and shows its failure in the open dialog; resolves to whether it passed.
  const attempt = async (run: () => Promise<{ error?: unknown }>): Promise<boolean> => {
    setBusy(true);
    setFailure(null);
    const { error } = await run();
    setBusy(false);
    if (error) setFailure(failureOf(error));
    return !error;
  };

  const savePassword = async (current: string, next: string) => {
    const saved = await attempt(() =>
      hasPassword
        ? withStepUp(() =>
            settle(authClient.changePassword({ currentPassword: current, newPassword: next })),
          )
        : withStepUp(() => setPassword(next)),
    );
    if (!saved) return;
    show(null);
    toast.success(copy.profile.passwordSaved);
    await load();
  };

  // The server asks the password back when the account has one; otherwise a code (step-up).
  const runMfa = async (action: MfaAction, password = "") => {
    if (action === "enable") {
      let started: Open | null = null;
      await attempt(async () => {
        const result = await settle(authClient.twoFactor.enable({ password }));
        if (result.data && "totpURI" in result.data)
          started = { kind: "setup", uri: result.data.totpURI, codes: result.data.backupCodes };
        return result;
      });
      if (started) show(started);
      return;
    }
    if (action === "disable") {
      const off = await attempt(() =>
        withStepUp(() => settle(authClient.twoFactor.disable({ password }))),
      );
      if (off) {
        show(null);
        toast.success(copy.profile.mfaOff);
      }
      return;
    }
    let codes: string[] = [];
    await attempt(async () => {
      const result = await withStepUp(() =>
        settle(authClient.twoFactor.generateBackupCodes({ password })),
      );
      codes = result.data?.backupCodes ?? [];
      return result;
    });
    if (codes.length) show({ kind: "codes", codes });
  };

  const startMfa = (action: MfaAction) =>
    hasPassword ? show({ kind: "confirm", action }) : void runMfa(action);

  const verifySetup = async (code: string, codes: string[]) => {
    const on = await attempt(() => settle(verifySecondFactor("totp", code, false)));
    if (!on) return;
    show({ kind: "codes", codes });
    toast.success(copy.profile.mfaOn);
  };

  // Better Auth also wants a session younger than a day here; like account deletion, sign in again.
  const addPasskey = async () => {
    let stale = false;
    const added = await attempt(async () => {
      const result = await withStepUp(() => settle(authClient.passkey.addPasskey()));
      stale = isRecord(result.error) && Reflect.get(result.error, "code") === "SESSION_NOT_FRESH";
      return result;
    });
    if (stale) return signOutAndReload("/login?error=SESSION_EXPIRED");
    if (!added) return;
    toast.success(copy.profile.passkeyAdded);
    await load();
  };

  const renamePasskey = async (id: string, name: string) => {
    if (!(await attempt(() => settle(authClient.passkey.updatePasskey({ id, name }))))) return;
    show({ kind: "passkeys" });
    await load();
  };

  const removePasskey = async (id: string) => {
    if (!(await attempt(() => settle(authClient.passkey.deletePasskey({ id }))))) return;
    toast.success(copy.profile.passkeyRemoved);
    await load();
  };

  const copyText = async (text: string) => {
    await navigator.clipboard.writeText(text).catch(() => undefined);
    toast.success(authCopy.mfaSetup.copied);
  };

  const download = (codes: string[]) => {
    const url = URL.createObjectURL(new Blob([codes.join("\n")], { type: "text/plain" }));
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: authCopy.mfaSetup.fileName,
    });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className={accountPage}>
      <Helmet>
        <title>{copy.pageTitle.security}</title>
      </Helmet>
      <PageHeader
        title={copy.profile.securityPageTitle}
        subtitle={copy.profile.securityLead}
        className="px-1"
      />

      <div className={accountGroups}>
        <ListGroup title={copy.profile.groupSignIn}>
          <ListRow
            label={copy.profile.password}
            value={
              credential
                ? fill(copy.profile.passwordChanged, {
                    when: formatDistanceToNow(credential.updatedAt, {
                      addSuffix: true,
                      locale: ptBR,
                    }),
                  })
                : copy.profile.passwordSet
            }
            accessory="chevron"
            disabled={accounts === undefined}
            onClick={() => show({ kind: "password" })}
          />
          {passkeys && (
            <ListRow
              label={copy.profile.passkeys}
              value={passkeys.length}
              accessory="chevron"
              onClick={() => show({ kind: "passkeys" })}
            />
          )}
        </ListGroup>

        <ListGroup title={copy.profile.groupMfa} footer={copy.profile.mfaFooter}>
          <ListRow
            label={copy.profile.mfaApp}
            trailing={
              <Switch
                checked={mfaOn}
                disabled={accounts === undefined || busy}
                aria-label={copy.profile.mfaApp}
                onCheckedChange={(on) => startMfa(on ? "enable" : "disable")}
              />
            }
          />
          {mfaOn && (
            <ListRow
              label={copy.profile.mfaCodes}
              value={copy.profile.mfaCodesNew}
              accessory="chevron"
              onClick={() => startMfa("codes")}
            />
          )}
        </ListGroup>

        <ListGroup title={copy.profile.groupSessions} footer={copy.profile.sessionsFooter}>
          {[...(sessions ?? [])]
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .map((session) => {
              const { browser, os, mobile } = parseUserAgent(session.userAgent);
              const when = formatDistanceToNow(session.updatedAt, {
                addSuffix: true,
                locale: ptBR,
              });
              return (
                <SessionRow
                  key={session.id}
                  mobile={mobile}
                  label={[browser, os].filter(Boolean).join(" · ") || copy.profile.unknownDevice}
                  meta={
                    session.ipAddress
                      ? fill(copy.profile.sessionMeta, { place: session.ipAddress, when })
                      : when
                  }
                  current={session.id === currentId}
                  onRevoke={() => void revoke(session.token)}
                />
              );
            })}
        </ListGroup>

        {sessions && sessions.length > 1 && (
          <ListGroup>
            <ListRow label={copy.profile.revokeOthers} danger onClick={() => void revokeOthers()} />
          </ListGroup>
        )}
      </div>

      <Dialog open={open !== null} onOpenChange={(next) => !next && show(null)}>
        <DialogContent>
          {open?.kind === "password" && (
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                void savePassword(formString(form, "current"), formString(form, "new"));
              }}
            >
              <DialogHeader>
                <DialogTitle>
                  {hasPassword ? copy.profile.password : copy.profile.passwordSet}
                </DialogTitle>
              </DialogHeader>
              {hasPassword && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="current">{copy.profile.passwordCurrent}</Label>
                  <Input
                    id="current"
                    name="current"
                    type="password"
                    required
                    autoComplete="current-password"
                    className={FIELD}
                  />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Label htmlFor="new">{copy.profile.passwordNew}</Label>
                <Input
                  id="new"
                  name="new"
                  type="password"
                  required
                  minLength={10}
                  maxLength={128}
                  autoComplete="new-password"
                  aria-describedby="new-hint"
                  className={FIELD}
                />
                <p id="new-hint" className="text-footnote text-ink-secondary">
                  {authCopy.shell.newPasswordHint}
                </p>
              </div>
              <ErrorLine failure={failure} />
              <DialogFooter>
                <Button type="submit" loading={busy}>
                  {copy.profile.passwordSave}
                </Button>
              </DialogFooter>
            </form>
          )}

          {open?.kind === "confirm" && (
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                void runMfa(open.action, formString(new FormData(e.currentTarget), "password"));
              }}
            >
              <DialogHeader>
                <DialogTitle>{copy.profile.groupMfa}</DialogTitle>
                <DialogDescription>{authCopy.mfaSetup.password}</DialogDescription>
              </DialogHeader>
              <Input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                aria-label={copy.profile.passwordCurrent}
                className={FIELD}
              />
              <ErrorLine failure={failure} />
              <DialogFooter>
                <Button type="submit" loading={busy}>
                  {authCopy.mfaSetup.continue}
                </Button>
              </DialogFooter>
            </form>
          )}

          {open?.kind === "setup" && (
            <>
              <DialogHeader>
                <DialogTitle>{authCopy.mfaSetup.title}</DialogTitle>
              </DialogHeader>
              <MfaSetup
                uri={open.uri}
                mobile={parseUserAgent(navigator.userAgent).mobile}
                onOpenUri={isTauri() ? () => void openExternal(open.uri) : undefined}
                onCopyKey={(key) => void copyText(key)}
                onVerify={(code) => void verifySetup(code, open.codes)}
                busy={busy}
                failure={failure}
              />
            </>
          )}

          {open?.kind === "passkeys" && (
            <>
              <DialogHeader>
                <DialogTitle>{copy.profile.passkeys}</DialogTitle>
                <DialogDescription>{copy.profile.passkeysLead}</DialogDescription>
              </DialogHeader>
              {passkeys?.length ? (
                <ListGroup>
                  {passkeys.map((passkey) => (
                    <PasskeyRow
                      key={passkey.id}
                      passkey={passkey}
                      onRename={() => show({ kind: "rename", passkey })}
                      onRemove={() => void removePasskey(passkey.id)}
                    />
                  ))}
                </ListGroup>
              ) : (
                <p className="text-subhead text-ink-secondary">{copy.profile.passkeysEmpty}</p>
              )}
              <ErrorLine failure={failure} />
              <DialogFooter>
                <Button loading={busy} onClick={() => void addPasskey()}>
                  {copy.profile.passkeyAdd}
                </Button>
              </DialogFooter>
            </>
          )}

          {open?.kind === "rename" && (
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                const name = formString(new FormData(e.currentTarget), "name").trim();
                void renamePasskey(open.passkey.id, name);
              }}
            >
              <DialogHeader>
                <DialogTitle>{copy.profile.passkeyName}</DialogTitle>
              </DialogHeader>
              <Input
                name="name"
                required
                maxLength={64}
                defaultValue={open.passkey.name ?? ""}
                aria-label={copy.profile.passkeyName}
                className={FIELD}
              />
              <ErrorLine failure={failure} />
              <DialogFooter>
                <Button type="submit" loading={busy}>
                  {copy.profile.passkeySave}
                </Button>
              </DialogFooter>
            </form>
          )}

          {open?.kind === "codes" && (
            <>
              <DialogHeader>
                <DialogTitle>{copy.profile.mfaCodes}</DialogTitle>
              </DialogHeader>
              <RecoveryCodes
                codes={open.codes}
                onCopy={() => void copyText(open.codes.join("\n"))}
                onDownload={() => download(open.codes)}
              />
              <DialogFooter>
                <Button onClick={() => show(null)}>{authCopy.mfaSetup.done}</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
