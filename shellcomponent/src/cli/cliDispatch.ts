import "./mkdirCommand.js";
import { dispatchCliLine as sdkDispatchCliLine } from "@keeper-security/keeper-sdk-javascript";
import { shellKeeperCliHost } from "./keeperCliHost.js";
import type { CliResult } from "./types.js";

const rawMax =
  typeof process !== "undefined" && process.env?.CLI_MAX_LINE_LENGTH
    ? Number(process.env.CLI_MAX_LINE_LENGTH)
    : NaN;
const MAX_LINE_LENGTH = Number.isFinite(rawMax) && rawMax > 0 ? rawMax : 8192;

/** Shell entry: line-length guard, then SDK dispatch (restore-session uses raw `--from-json` tail + JSON.parse). */
export async function dispatchCliLine(line: string): Promise<CliResult> {
  if (line.length > MAX_LINE_LENGTH) {
    return { code: 1, out: "", err: "line too long\n" };
  }

  return sdkDispatchCliLine(line, shellKeeperCliHost);
}
