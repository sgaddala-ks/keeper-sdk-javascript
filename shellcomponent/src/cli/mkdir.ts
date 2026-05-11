import { getDetailedHelpPage } from "./cliCommandDocs.js";
import { wantsCliHelp, type ParsedCli } from "./cliParse.js";
import type { CliResult } from "./types.js";

const MKDIR_OPTS = new Set(["p", "parents"]);

export async function mkdirCommand(parsed: ParsedCli): Promise<CliResult> {
  if (wantsCliHelp(parsed)) {
    const doc = getDetailedHelpPage("mkdir");
    return { code: 0, out: doc ?? "", err: "" };
  }
  for (const k of parsed.opts.keys()) {
    if (!MKDIR_OPTS.has(k)) {
      return { code: 1, out: "", err: `mkdir: unknown option --${k} (try: mkdir --help)\n` };
    }
  }

  return {
    code: 1,
    out: "",
    err:
      "mkdir: not available in keeper-shell (no host filesystem). " +
      "Set api-base to an HTTP CLI backend for workspace mkdir, or use Keeper vault folder APIs.\n",
  };
}
