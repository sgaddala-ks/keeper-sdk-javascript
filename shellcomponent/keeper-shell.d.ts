export type CliResult = {
  code: number;
  out: string;
  err: string;
  needPassword?: boolean;
  loginUsername?: string;
};

export type ShellCliContext = {
  keeperHost?: string;
};

export const KEEPER_SHELL_TAG: "keeper-shell";
export const WEB_CONSOLE_TAG: "web-console";

export class KeeperShell extends HTMLElement {
  keeperHost: string;
  collapsed: boolean;
  maskInput: boolean;
  embed: boolean;
  height: string;
}

/** `<web-console>` — extends {@link KeeperShell} (distinct class for dual registration). */
export class WebConsoleElement extends KeeperShell {}

/** Alias for {@link WebConsoleElement}. */
export type WebConsole = WebConsoleElement;

export function dispatchCliLine(line: string): Promise<CliResult>;
export function completeCliLine(line: string): {
  base: string;
  candidates: string[];
};

export function setShellCliContext(next: ShellCliContext): void;
export function resetShellVault(): void;
export function loginWithCredentials(username: string, password: string): Promise<CliResult>;
export function loginWithSessionToken(
  username: string,
  sessionToken: string,
  options?: { plainToken?: boolean }
): Promise<CliResult>;

declare global {
  interface HTMLElementTagNameMap {
    "keeper-shell": KeeperShell;
    "web-console": WebConsole;
  }
}
