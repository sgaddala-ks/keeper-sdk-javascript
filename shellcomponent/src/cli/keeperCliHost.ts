import type { KeeperCliHost, KeeperCliVault } from "@keeper-security/keeper-sdk-javascript";
import * as KeeperSdk from "@keeper-security/keeper-sdk-javascript";
import { envString, getShellKeeperHost } from "./cliContext.js";
import { InMemoryConfigLoader } from "./inMemoryConfigLoader.js";

const { KeeperVault, LogLevel, SessionManager, SdkDefaults } = KeeperSdk;

type VaultInstance = InstanceType<typeof KeeperVault>;

let vault: VaultInstance | null = null;

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

export function resetShellVault(): void {
  vault = null;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

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

function asCliVault(v: VaultInstance): KeeperCliVault {
  return {
    get isLoggedIn() {
      return v.isLoggedIn;
    },
    login: (u, p) => v.login(u, p),
    loginWithSessionToken: (u, t) => v.loginWithSessionToken(u, t),
    logout: () => v.logout(),
    sync: () => v.sync(),
    getRecords: () => v.getRecords(),
    getSharedFolders: () => v.getSharedFolders(),
    registerDevice: (dt, pk, o) => v.registerDevice(dt, pk, o),
    restoreSession: (input) => v.restoreSession(input),
  };
}

async function readTextFile(path: string): Promise<string> {
  const p = path.trim().replace(/^@/, "");
  if (/^https?:\/\//i.test(p)) {
    const res = await fetch(p);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} loading ${p}`);
    }
    return res.text();
  }

  const tryFetch = async (url: string): Promise<string | null> => {
    const res = await fetch(url);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("text/html")) return null;
    const text = await res.text();
    const head = text.trimStart().slice(0, 32).toLowerCase();
    if (head.startsWith("<!") || head.startsWith("<html")) return null;
    return text;
  };

  if (p.startsWith("/")) {
    const body = await tryFetch(`/@fs${p}`);
    if (body !== null) return body;
    throw new Error(
      `Could not read ${p} (HTTP failed). Run \`npm run dev\` in shellcomponent and ensure the path is allowed by Vite fs.allow.`
    );
  }

  if (import.meta.env?.DEV) {
    const fromDev = await tryFetch("/dev/keeper-session.json");
    if (fromDev !== null && (p === "conf.json" || p.endsWith("/conf.json"))) {
      return fromDev;
    }
  }

  const body = await tryFetch(p);
  if (body !== null) return body;

  throw new Error(
    `Could not read ${p}. In Vite dev use an absolute path:\n` +
      `  restore-session --from-json /Users/you/.../keeper-sdk-javascript/conf.json\n` +
      `  or: restore-session --from-json /dev/keeper-session.json`
  );
}

export const shellKeeperCliHost: KeeperCliHost = {
  getVault: () => asCliVault(getVault()),
  envString,
  formatError: formatKeeperClientError,
  readTextFile,
};
