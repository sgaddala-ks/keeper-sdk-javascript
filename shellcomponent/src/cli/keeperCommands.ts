/**
 * Maps parsed CLI lines to KeeperSdk (KeeperVault) — browser-friendly (no Node Buffer/path).
 */
import type { DRecord, DSharedFolder } from "@keeper-security/keeper-sdk-javascript";
import * as KeeperSdk from "@keeper-security/keeper-sdk-javascript";
import { getDetailedHelpPage } from "./cliCommandDocs.js";
import { envString, getShellKeeperHost } from "./cliContext.js";
import { InMemoryConfigLoader } from "./inMemoryConfigLoader.js";
import { getOpt, hasOpt, wantsCliHelp, type ParsedCli } from "./cliParse.js";
import type { CliResult } from "./types.js";

const { KeeperVault, LogLevel, SessionManager, getRecordTitle, SdkDefaults } = KeeperSdk;

type VaultInstance = InstanceType<typeof KeeperVault>;

const LOGIN_OPT_NAMES = new Set([
  "username",
  "user",
  "session-token",
  "token",
  "st",
  "session-token-plain",
]);

let vault: VaultInstance | null = null;

function utf8ToBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]!);
  }
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function getVault(): VaultInstance {
  if (!vault) {
    const host = getShellKeeperHost();
    vault = new KeeperVault({
      ...(host ? { host } : {}),
      useConsoleAuth: false,
      logLevel: LogLevel.WARN,
      sessionStorage: new SessionManager(new InMemoryConfigLoader()),
    });
    if (import.meta.env?.DEV === true) {
      const devDevice =
        import.meta.env.VITE_KEEPER_DEV_DEVICE_USER &&
        import.meta.env.VITE_KEEPER_DEV_DEVICE_TOKEN &&
        import.meta.env.VITE_KEEPER_DEV_DEVICE_PRIVATE_KEY;
      console.info("[keeper-shell dev] KeeperVault created", {
        host: host || "(SDK default; US prod host if unset)",
        clientVersion: SdkDefaults.CLIENT_VERSION,
        useConsoleAuth: false,
        logLevel: "WARN",
        preseededDeviceFromEnv: Boolean(devDevice),
      });
    }
  }
  return vault;
}

/** Reset vault singleton (e.g. after keeper-host attribute change). */
export function resetShellVault(): void {
  vault = null;
}

function recordUid(rec: { uid?: string }): string {
  return rec.uid || "(unknown uid)";
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Enriches errors where the browser only reports "Failed to fetch" (no status/CORS detail).
 */
function formatKeeperClientError(context: string, e: unknown): string {
  const base = errMsg(e);
  const inBrowser = typeof document !== "undefined";
  if (!inBrowser) {
    return `${context}: ${base}\n`;
  }
  const low = base.toLowerCase();
  const fetchish =
    low.includes("failed to fetch") ||
    low.includes("networkerror") ||
    low.includes("load failed") ||
    low.includes("network request failed");
  if (!fetchish) {
    return `${context}: ${base}\n`;
  }
  const host = getShellKeeperHost();
  const hostHint = host
    ? `\n  Region/host in use: ${host} — wrong region can look like a network error; adjust keeper-host or KEEPER_HOST if needed.`
    : `\n  Region/host: default production (US). EU/AU/CA/JP tenants often need keeper-host on <web-console> or KEEPER_HOST.`;
  return (
    `${context}: ${base}\n` +
    `  Why only this text: browsers intentionally hide the underlying HTTP status / CORS detail for many failed requests.\n` +
    `  Typical causes (your password may still be correct):\n` +
    `  • CORS — Keeper’s API may not allow calls from this page’s origin (common for http://localhost in dev).\n` +
    `  • Network — offline, DNS, VPN, corporate proxy, or firewall blocking HTTPS to Keeper.\n` +
    `  • Mixed content — page is http while the API is https; load the dev page over https.\n` +
    hostHint +
    `\n  Mitigation: run login from a backend your page trusts (set web-console remote + api-base), or use the SDK from Node.js.\n`
  );
}

/** Shared login used by CLI and shell password transport (password never in `line`). */
export async function loginWithCredentials(username: string, password: string): Promise<CliResult> {
  try {
    const v = getVault();
    if (v.isLoggedIn) {
      await v.logout();
    }
    await v.login(username, password);
    await v.sync();
    return { code: 0, out: `keeper: logged in as ${username}.\n`, err: "" };
  } catch (e) {
    return { code: 1, out: "", err: formatKeeperClientError("keeper", e) };
  }
}

export async function loginWithSessionTokenCredentials(
  username: string,
  sessionToken: string,
  options?: { plainToken?: boolean }
): Promise<CliResult> {
  let token = sessionToken.trim();
  if (options?.plainToken && token.length > 0) {
    token = utf8ToBase64Url(token);
  }
  try {
    const v = getVault();
    if (v.isLoggedIn) {
      await v.logout();
    }
    await v.loginWithSessionToken(username, token);
    await v.sync();
    return { code: 0, out: `keeper: logged in as ${username} (session token).\n`, err: "" };
  } catch (e) {
    return { code: 1, out: "", err: formatKeeperClientError("keeper", e) };
  }
}

export async function keeperLoginCommand(parsed?: ParsedCli): Promise<CliResult> {
  const opts = parsed?.opts ?? new Map<string, string | true>();
  if (parsed && wantsCliHelp(parsed)) {
    return { code: 0, out: getDetailedHelpPage("login") ?? "", err: "" };
  }
  if (parsed) {
    for (const secretFlag of ["password", "pass", "pwd"] as const) {
      if (opts.has(secretFlag)) {
        return {
          code: 1,
          out: "",
          err:
            "login: do not pass --password on the command line (it is logged and visible). " +
            "Use KEEPER_PASSWORD for automation, or run `login --username …` in the shell and enter the password when prompted (masked).\n",
        };
      }
    }
    for (const k of opts.keys()) {
      if (!LOGIN_OPT_NAMES.has(k)) {
        return { code: 1, out: "", err: `login: unknown option --${k}\n` };
      }
    }
  }

  const username = getOpt(opts, "username", "user") ?? envString("KEEPER_USERNAME");
  const passwordEnv = envString("KEEPER_PASSWORD");
  const sessionRaw = getOpt(opts, "session-token", "token", "st") ?? envString("KEEPER_SESSION_TOKEN");
  const sessionPlain = parsed && hasOpt(opts, "session-token-plain");

  if (parsed) {
    const stPlainVal = opts.get("session-token-plain");
    if (stPlainVal !== undefined && stPlainVal !== true) {
      return {
        code: 1,
        out: "",
        err: "login: --session-token-plain is a boolean flag (no value)\n",
      };
    }
  }

  if (!username) {
    return {
      code: 1,
      out: "",
      err: "login: provide --username or KEEPER_USERNAME.\n",
    };
  }

  const sessionTrimmed = typeof sessionRaw === "string" ? sessionRaw.trim() : "";
  if (sessionTrimmed.length > 0) {
    return loginWithSessionTokenCredentials(username, sessionTrimmed, {
      plainToken: !!sessionPlain,
    });
  }

  if (!passwordEnv) {
    return {
      code: 1,
      needPassword: true,
      loginUsername: username,
      out: "",
      err: "",
    };
  }

  return loginWithCredentials(username, passwordEnv);
}

export async function keeperLogoutCommand(parsed?: ParsedCli): Promise<CliResult> {
  if (parsed && wantsCliHelp(parsed)) {
    return { code: 0, out: getDetailedHelpPage("logout") ?? "", err: "" };
  }
  if (parsed && parsed.opts.size > 0) {
    return { code: 1, out: "", err: "logout: no options (try: logout --help)\n" };
  }
  if (parsed && parsed.positional.length > 0) {
    return { code: 1, out: "", err: "Usage: logout\n" };
  }
  try {
    const v = getVault();
    if (!v.isLoggedIn) {
      return { code: 0, out: "keeper: already logged out.\n", err: "" };
    }
    await v.logout();
    return { code: 0, out: "keeper: logged out.\n", err: "" };
  } catch (e) {
    return { code: 1, out: "", err: formatKeeperClientError("keeper", e) };
  }
}

export async function keeperRecordsCommand(parsed: ParsedCli): Promise<CliResult> {
  if (wantsCliHelp(parsed)) {
    return { code: 0, out: getDetailedHelpPage("records") ?? "", err: "" };
  }
  if (parsed.opts.size > 0) {
    return { code: 1, out: "", err: "records: unknown option (try: records --help)\n" };
  }
  const sub = parsed.positional[0]?.toLowerCase();
  if (parsed.positional.length > 1) {
    return { code: 1, out: "", err: "Usage: records [list]\n" };
  }
  if (sub && sub !== "list") {
    return { code: 1, out: "", err: "Usage: records [list]\n" };
  }
  try {
    const v = getVault();
    if (!v.isLoggedIn) {
      const r = await keeperLoginCommand();
      if (r.code !== 0) return r;
    }
    await v.sync();
    const records = v.getRecords();
    const rows = records.map((r: DRecord) => `${recordUid(r)}\t${getRecordTitle(r)}`);
    const header = "record_uid\ttitle\n";
    const body = rows.length ? rows.join("\n") + "\n" : "(no records)\n";
    return { code: 0, out: header + body, err: "" };
  } catch (e) {
    return { code: 1, out: "", err: formatKeeperClientError("records", e) };
  }
}

export async function keeperFoldersCommand(parsed: ParsedCli): Promise<CliResult> {
  if (wantsCliHelp(parsed)) {
    return { code: 0, out: getDetailedHelpPage("folders") ?? "", err: "" };
  }
  if (parsed.opts.size > 0) {
    return { code: 1, out: "", err: "folders: unknown option (try: folders --help)\n" };
  }
  const sub = parsed.positional[0]?.toLowerCase();
  if (parsed.positional.length > 1) {
    return { code: 1, out: "", err: "Usage: folders [list]\n" };
  }
  if (sub && sub !== "list") {
    return { code: 1, out: "", err: "Usage: folders [list]\n" };
  }
  try {
    const v = getVault();
    if (!v.isLoggedIn) {
      const r = await keeperLoginCommand();
      if (r.code !== 0) return r;
    }
    await v.sync();
    const folders = v.getSharedFolders();
    const rows = folders.map((f: DSharedFolder) => {
      const name = f.name ?? "(unnamed)";
      const uid = f.uid ?? "(unknown uid)";
      return `${uid}\t${name}`;
    });
    const header = "shared_folder_uid\tname\n";
    const body = rows.length ? rows.join("\n") + "\n" : "(no shared folders)\n";
    return { code: 0, out: header + body, err: "" };
  } catch (e) {
    return { code: 1, out: "", err: formatKeeperClientError("folders", e) };
  }
}

const REGISTER_DEVICE_OPTS = new Set([
  "device-token",
  "dt",
  "private-key",
  "pk",
  "username",
  "user",
]);

export async function registerDeviceCommand(parsed: ParsedCli): Promise<CliResult> {
  if (wantsCliHelp(parsed)) {
    return { code: 0, out: getDetailedHelpPage("register-device") ?? "", err: "" };
  }
  for (const k of parsed.opts.keys()) {
    if (!REGISTER_DEVICE_OPTS.has(k)) {
      return { code: 1, out: "", err: `register-device: unknown option --${k}\n` };
    }
  }
  if (parsed.positional.length > 0) {
    return {
      code: 1,
      out: "",
      err: "register-device: unexpected positional arguments\n",
    };
  }

  const deviceToken = getOpt(parsed.opts, "device-token", "dt") ?? envString("REGISTER_DEVICE_TOKEN");
  const privateKey = getOpt(parsed.opts, "private-key", "pk") ?? envString("REGISTER_DEVICE_PRIVATE_KEY");
  const usernameOpt = getOpt(parsed.opts, "username", "user");
  const username = usernameOpt?.trim() || undefined;

  const dt = typeof deviceToken === "string" ? deviceToken.trim() : "";
  const pk = typeof privateKey === "string" ? privateKey.trim() : "";
  if (!dt || !pk) {
    return {
      code: 1,
      out: "",
      err:
        "register-device: --device-token and --private-key required " +
        "(or REGISTER_DEVICE_TOKEN / REGISTER_DEVICE_PRIVATE_KEY env).\n",
    };
  }

  try {
    const v = getVault();
    type RegisterFn = (dt: string, pk: string, o?: { username?: string }) => Promise<void>;
    const registerDevice = (v as { registerDevice?: RegisterFn }).registerDevice;
    if (typeof registerDevice !== "function") {
      return {
        code: 1,
        out: "",
        err:
          "register-device: not available in this SDK version. Upgrade @keeper-security/keeper-sdk-javascript.\n",
      };
    }
    await registerDevice.call(v, dt, pk, username ? { username } : undefined);
    const umsg = username ? ` Last username set to ${username}.` : "";
    return {
      code: 0,
      out: `keeper: device credentials stored in this shell’s session.${umsg} Next: login --username … --session-token …\n`,
      err: "",
    };
  } catch (e) {
    return { code: 1, out: "", err: formatKeeperClientError("register-device", e) };
  }
}
