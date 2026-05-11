import { wantsCliHelp, type ParsedCli } from "./cliParse.js";
import { getDetailedHelpPage } from "./cliCommandDocs.js";
import type { CliResult } from "./types.js";

type CliHelpEntry = {
  name: string;
  usage: string;
  description: string;
};

const CLI_COMMANDS: CliHelpEntry[] = [
  {
    name: "folders",
    usage: "folders [list] [--help|-h]",
    description: "List shared folders in the vault (uses env or `login --username …`).",
  },
  {
    name: "help",
    usage: "help [command]  (see also: help --help)",
    description: "Show all commands, or full docs for one command (same as COMMAND --help).",
  },
  {
    name: "login",
    usage:
      "login [--username|--user <u>] [--session-token|--token|--st <t>] [--session-token-plain] [--help|-h]",
    description:
      "Log in with password (env / masked prompt) or session token (flag or KEEPER_SESSION_TOKEN). Password never on CLI line.",
  },
  {
    name: "logout",
    usage: "logout [--help|-h]",
    description: "Log out of the current Keeper session.",
  },
  {
    name: "mkdir",
    usage: "mkdir [-p|--parents] [--] <dir>   ;  mkdir --help",
    description:
      "Host mkdir is disabled in keeper-shell (no filesystem). Use `api-base` for an HTTP CLI backend, or SDK folder APIs.",
  },
  {
    name: "records",
    usage: "records [list] [--help|-h]",
    description: "List vault records (uid and title).",
  },
  {
    name: "register-device",
    usage:
      "register-device --device-token|--dt <b64> --private-key|--pk <b64> [--username <u>] [--help|-h]",
    description:
      "Store device token + private key in this shell’s session so session-token login works (see login --help).",
  },
].sort((a, b) => a.name.localeCompare(b.name));

/** Top-level names for tab completion (sorted). */
export const CLI_TOP_LEVEL_NAMES: readonly string[] = CLI_COMMANDS.map((c) => c.name);

function formatAllCommands(): string {
  const w = Math.max(...CLI_COMMANDS.map((c) => c.name.length), 8);
  let out = "Supported commands:\n\n";
  for (const c of CLI_COMMANDS) {
    out += `  ${c.name.padEnd(w)}  ${c.description}\n`;
  }
  out += "\nOptions use GNU-style syntax: `--name`, `--name=value`, short flags (`-p` or `-rf` when each letter is a switch), and `--` ends options.\n";
  out += "Quoted arguments and `\\` escapes are supported.\n\n";
  out += "Run `help <command>` for a short summary, or `command --help` / `command -h` for full documentation.\n";
  return out;
}

function formatOne(name: string): CliResult {
  const key = name.toLowerCase();
  const long = getDetailedHelpPage(key);
  if (long) {
    return { code: 0, out: long, err: "" };
  }
  const c = CLI_COMMANDS.find((e) => e.name === key);
  if (!c) {
    return { code: 1, out: "", err: `help: unknown command: ${name}\n` };
  }
  const out = `${c.name} — ${c.description}\n  Usage: ${c.usage}\n`;
  return { code: 0, out, err: "" };
}

export function helpCommand(parsed: ParsedCli): CliResult {
  if (wantsCliHelp(parsed)) {
    const h = getDetailedHelpPage("help");
    return { code: 0, out: h ?? "", err: "" };
  }
  if (parsed.opts.size > 0) {
    return { code: 1, out: "", err: "help: unknown option (try `help --help`)\n" };
  }
  const args = parsed.positional;
  if (args.length === 0) {
    return { code: 0, out: formatAllCommands(), err: "" };
  }
  if (args.length > 1) {
    return { code: 1, out: "", err: "Usage: help [command]\n" };
  }
  return formatOne(args[0]);
}
