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
    sync: async () => {
      await v.sync();
    },
    getRecords: () => v.getRecords(),
    getSharedFolders: () => v.getSharedFolders(),
    registerDevice: (dt, pk, o) => v.registerDevice(dt, pk, o),
  };
}

export const shellKeeperCliHost: KeeperCliHost = {
  getVault: () => asCliVault(getVault()),
  envString,
  formatError: formatKeeperClientError,
};
