import { mkdirCommand } from "./mkdir.js";
import {
  keeperLoginCommand,
  keeperLogoutCommand,
  keeperRecordsCommand,
  keeperFoldersCommand,
  registerDeviceCommand,
} from "./keeperCommands.js";
import { helpCommand } from "./cliHelp.js";
import { tokenizeArguments, parseCliArgs } from "./cliParse.js";
import type { CliResult } from "./types.js";

const MAX_LINE_LENGTH = Number(process.env.CLI_MAX_LINE_LENGTH) || 8192;

export async function dispatchCliLine(line: string): Promise<CliResult> {
  if (line.length > MAX_LINE_LENGTH) {
    return { code: 1, out: "", err: "line too long\n" };
  }

  const tokens = tokenizeArguments(line.trim());
  const name = tokens[0]?.toLowerCase();
  const rest = tokens.slice(1);
  const parsed = parseCliArgs(rest);

  if (!name) {
    return { code: 0, out: "", err: "" };
  }

  switch (name) {
    case "help":
      return helpCommand(parsed);
    case "mkdir":
      return mkdirCommand(parsed);
    case "login":
      return keeperLoginCommand(parsed);
    case "logout":
      return keeperLogoutCommand(parsed);
    case "records":
      return keeperRecordsCommand(parsed);
    case "folders":
      return keeperFoldersCommand(parsed);
    case "register-device":
      return registerDeviceCommand(parsed);
    default:
      return { code: 1, out: "", err: `Unknown command: ${name}\n` };
  }
}
