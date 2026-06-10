export type ShellCliContext = {
  /** Optional Keeper host / region (overrides KEEPER_HOST when set). */
  keeperHost?: string;
};

let ctx: ShellCliContext = {};

export function setShellCliContext(next: ShellCliContext): void {
  ctx = { ...next };
}

export function getShellKeeperHost(): string | undefined {
  const fromCtx = ctx.keeperHost?.trim();
  if (fromCtx) return fromCtx;
  if (typeof process !== "undefined" && process.env) {
    const h = (process.env.KEEPER_HOST || "").trim();
    if (h) return h;
  }
  return undefined;
}

const VITE_ENV_MAP: Record<string, string> = {
  KEEPER_USERNAME: "VITE_KEEPER_USERNAME",
  KEEPER_PASSWORD: "VITE_KEEPER_PASSWORD",
  KEEPER_SESSION_TOKEN: "VITE_KEEPER_SESSION_TOKEN",
  KEEPER_HOST: "VITE_KEEPER_HOST",
  REGISTER_DEVICE_TOKEN: "VITE_REGISTER_DEVICE_TOKEN",
  REGISTER_DEVICE_PRIVATE_KEY: "VITE_REGISTER_DEVICE_PRIVATE_KEY",
  RESTORE_SESSION_JSON: "VITE_RESTORE_SESSION_JSON",
};

function readViteEnv(name: string): string | undefined {
  try {
    const viteKey = VITE_ENV_MAP[name];
    if (!viteKey || typeof import.meta === "undefined" || !import.meta.env) return undefined;
    const v = import.meta.env[viteKey as keyof ImportMetaEnv] as string | undefined;
    const t = typeof v === "string" ? v.trim() : "";
    return t.length > 0 ? t : undefined;
  } catch {
    return undefined;
  }
}

/** Node `process.env` in SSR/build; `import.meta.env.VITE_*` in the browser dev bundle. */
export function envString(name: string): string | undefined {
  if (typeof process !== "undefined" && process.env) {
    const v = process.env[name];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return readViteEnv(name);
}
