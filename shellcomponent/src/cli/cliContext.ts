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

export function envString(name: string): string | undefined {
  if (typeof process !== "undefined" && process.env) {
    const v = process.env[name];
    return typeof v === "string" && v.length > 0 ? v : undefined;
  }
  return undefined;
}
