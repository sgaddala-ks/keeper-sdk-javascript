/**
 * Maps parsed CLI lines to KeeperSdk (KeeperVault) calls.
 */
import { Buffer } from "node:buffer";
import path from "node:path";
import {
  KeeperVault,
  LogLevel,
  getRecordTitle,
  type DRecord,
  type DSharedFolder,
} from "@keeper-security/keeper-sdk-javascript";
import { getDetailedHelpPage } from "./cliCommandDocs.js";
import { getOpt, hasOpt, wantsCliHelp, type ParsedCli } from "./cliParse.js";
import type { CliResult } from "./types.js";

const LOGIN_OPT_NAMES = new Set([
  "username",
  "user",
  "session-token",
  "token",
  "st",
  "session-token-plain",
]);

let vault: KeeperVault | null = null;

function getHost(): string | undefined {
  const h = (process.env.KEEPER_HOST || "").trim();
  return h || undefined;
}

function getVault(): KeeperVault {
  if (!vault) {
    vault = new KeeperVault({
      host: getHost(),
      configDir: process.env.KEEPER_CONFIG_DIR || path.join(process.cwd(), ".keeper"),
      useConsoleAuth: false,
      logLevel: LogLevel.WARN,
    });
  }
  return vault;
}

function recordUid(rec: { uid?: string }): string {
  return rec.uid || "(unknown uid)";
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Shared login used by CLI and POST `/api/cli/login` (password never in `line`). */
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
    return { code: 1, out: "", err: `keeper: ${errMsg(e)}\n` };
  }
}

/**
 * KeeperVault.loginWithSessionToken — device must be registered for this host
 * (prior normal login in KEEPER_CONFIG_DIR), unless you seed SessionManager (see SDK examples).
 */
export async function loginWithSessionTokenCredentials(
  username: string,
  sessionToken: string,
  options?: { plainToken?: boolean }
): Promise<CliResult> {
  let token = sessionToken.trim();
  if (options?.plainToken && token.length > 0) {
    token = Buffer.from(token, "utf8").toString("base64url");
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
    return { code: 1, out: "", err: `keeper: ${errMsg(e)}\n` };
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
            "Use KEEPER_PASSWORD for automation, or run `login --username …` in the web console and enter the password when prompted (masked).\n",
        };
      }
    }
    for (const k of opts.keys()) {
      if (!LOGIN_OPT_NAMES.has(k)) {
        return { code: 1, out: "", err: `login: unknown option --${k}\n` };
      }
    }
  }

  const username = getOpt(opts, "username", "user") ?? process.env.KEEPER_USERNAME;
  const passwordEnv = process.env.KEEPER_PASSWORD;
  const sessionRaw =
    getOpt(opts, "session-token", "token", "st") ?? process.env.KEEPER_SESSION_TOKEN;
  const sessionPlain =
    parsed && hasOpt(opts, "session-token-plain");

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
    return { code: 1, out: "", err: `keeper: ${errMsg(e)}\n` };
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
    return { code: 1, out: "", err: `records: ${errMsg(e)}\n` };
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
    return { code: 1, out: "", err: `folders: ${errMsg(e)}\n` };
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

/**
 * Store device token + private key in SessionManager for the current host (KEEPER_CONFIG_DIR),
 * so `login --session-token` works without a prior password login on this machine.
 */
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

  const deviceToken =
    getOpt(parsed.opts, "device-token", "dt") ?? process.env.REGISTER_DEVICE_TOKEN;
  const privateKey =
    getOpt(parsed.opts, "private-key", "pk") ?? process.env.REGISTER_DEVICE_PRIVATE_KEY;
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
    await v.registerDevice(dt, pk, username ? { username } : undefined);
    const umsg = username ? ` Last username set to ${username}.` : "";
    return {
      code: 0,
      out: `keeper: device credentials stored for this host (see KEEPER_CONFIG_DIR).${umsg} Next: login --username … --session-token …\n`,
      err: "",
    };
  } catch (e) {
    return { code: 1, out: "", err: `register-device: ${errMsg(e)}\n` };
  }
}
