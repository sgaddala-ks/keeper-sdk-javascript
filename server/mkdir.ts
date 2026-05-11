import fs from "node:fs/promises";
import path from "node:path";
import { getDetailedHelpPage } from "./cliCommandDocs.js";
import { hasOpt, wantsCliHelp, type ParsedCli } from "./cliParse.js";
import type { CliResult } from "./types.js";

function workspaceRoot(): string {
  return path.resolve(process.env.CLI_DATA_DIR || process.cwd());
}

function resolveSafeDir(
  raw: string,
  base: string
): { ok: true; target: string } | { ok: false; err: string } {
  if (path.isAbsolute(raw)) {
    return {
      ok: false,
      err: "mkdir: absolute paths are not allowed; use a path relative to the workspace.\n",
    };
  }
  const target = path.resolve(base, raw);
  const rel = path.relative(base, target);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    return { ok: false, err: "mkdir: path escapes workspace\n" };
  }
  return { ok: true, target };
}

const MKDIR_OPTS = new Set(["p", "parents"]);

export async function mkdirCommand(parsed: ParsedCli, cwd = workspaceRoot()): Promise<CliResult> {
  if (wantsCliHelp(parsed)) {
    const doc = getDetailedHelpPage("mkdir");
    return { code: 0, out: doc ?? "", err: "" };
  }
  for (const k of parsed.opts.keys()) {
    if (!MKDIR_OPTS.has(k)) {
      return { code: 1, out: "", err: `mkdir: unknown option --${k} (try: mkdir --help)\n` };
    }
  }

  const paths = parsed.positional;
  if (paths.length !== 1) {
    return { code: 1, out: "", err: "Usage: mkdir [-p|--parents] <dir>\n" };
  }

  const dir = paths[0];
  const recursive = hasOpt(parsed.opts, "p", "parents");

  const base = path.resolve(cwd);
  const resolved = resolveSafeDir(dir, base);
  if (!resolved.ok) {
    return { code: 1, out: "", err: resolved.err };
  }

  try {
    await fs.mkdir(resolved.target, { recursive });
    return {
      code: 0,
      out: `mkdir: "${dir}" completed successfully.\n`,
      err: "",
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { code: 1, out: "", err: `mkdir: ${msg}\n` };
  }
}
