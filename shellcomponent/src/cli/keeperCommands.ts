/**
 * Shell exports for Keeper CLI login helpers (used by UI password transport).
 */
import {
  loginWithCredentials as sdkLoginWithCredentials,
  loginWithSessionToken as sdkLoginWithSessionToken,
  type CliResult,
} from "@keeper-security/keeper-sdk-javascript";
import { shellKeeperCliHost } from "./keeperCliHost.js";

export { resetShellVault } from "./keeperCliHost.js";

export async function loginWithCredentials(username: string, password: string): Promise<CliResult> {
  return sdkLoginWithCredentials(shellKeeperCliHost, username, password);
}

export async function loginWithSessionTokenCredentials(
  username: string,
  sessionToken: string,
  options?: { plainToken?: boolean }
): Promise<CliResult> {
  return sdkLoginWithSessionToken(shellKeeperCliHost, username, sessionToken, options);
}
