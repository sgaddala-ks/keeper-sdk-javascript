import "./bufferPolyfill.js";
/** Registers `<keeper-shell>` and `<web-console>`. */
import "./KeeperShell.js";

export {
  KeeperShell,
  WebConsoleElement,
  WebConsoleElement as WebConsole,
  KEEPER_SHELL_TAG,
  WEB_CONSOLE_TAG,
} from "./KeeperShell.js";
export { dispatchCliLine } from "./cli/cliDispatch.js";
export { completeCliLine } from "./cli/cliComplete.js";
export type { CliResult } from "./cli/types.js";
export type { ShellCliContext } from "./cli/cliContext.js";
export { setShellCliContext } from "./cli/cliContext.js";
export {
  resetShellVault,
  loginWithCredentials,
  loginWithSessionToken,
} from "./cli/keeperCommands.js";
