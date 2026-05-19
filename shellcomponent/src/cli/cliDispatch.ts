import "./mkdirCommand.js";
import { dispatchKeeperCli, tokenizeArguments } from "@keeper-security/keeper-sdk-javascript";
import { shellKeeperCliHost } from "./keeperCliHost.js";
import type { CliResult } from "./types.js";

const rawMax =
  typeof process !== "undefined" && process.env?.CLI_MAX_LINE_LENGTH
    ? Number(process.env.CLI_MAX_LINE_LENGTH)
    : NaN;
const MAX_LINE_LENGTH = Number.isFinite(rawMax) && rawMax > 0 ? rawMax : 8192;

export async function dispatchCliLine(line: string): Promise<CliResult> {
  if (line.length > MAX_LINE_LENGTH) {
    return { code: 1, out: "", err: "line too long\n" };
  }

  const tokens = tokenizeArguments(line.trim());
  const name = tokens[0]?.toLowerCase();
  if (!name) {
    return { code: 0, out: "", err: "" };
  }

  return dispatchKeeperCli(name, tokens.slice(1), shellKeeperCliHost);
}
