import {
  registerCliCommand,
  rejectUnknownOptions,
  type CliCommandDefinition,
} from "@keeper-security/keeper-sdk-javascript";

const MKDIR_ALLOWED = new Set(["p", "parents"]);

export const mkdirShellCommand: CliCommandDefinition = {
  name: "mkdir",
  order: 900,
  description:
    "Host mkdir is disabled in keeper-shell (no filesystem). Use `api-base` for an HTTP CLI backend, or SDK folder APIs.",
  usage: "mkdir [-p|--parents] [--] <dir>   ;  mkdir --help",
  flagOptions: ["-p", "--parents"],
  allowedOptions: MKDIR_ALLOWED,
  help: {
    title: "mkdir — host filesystem directory (disabled in embedded shell)",
    synopsis: "  mkdir [-p|--parents] [--] RELATIVE_PATH",
    description: `  In keeper-shell with in-browser SDK transport, host mkdir is not available (no
  sandboxed filesystem). Set api-base to an HTTP CLI backend if you need
  this command, or use Keeper vault folder APIs in code.`,
    options: `  -p, --parents    (remote server only.)
  --               End of options.`,
    note: "  Vault folder operations live on KeeperVault (mkdir, addFolder, …) in the SDK.",
  },
  async run(_host, parsed) {
    const bad = rejectUnknownOptions(parsed, MKDIR_ALLOWED, "mkdir");
    if (bad) return bad;
    return {
      code: 1,
      out: "",
      err:
        "mkdir: not available in keeper-shell (no host filesystem). " +
        "Set api-base to an HTTP CLI backend for workspace mkdir, or use Keeper vault folder APIs.\n",
    };
  },
};

registerCliCommand(mkdirShellCommand);
