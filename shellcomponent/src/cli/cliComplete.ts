/**
 * Tab-completion metadata for the keeper-shell CLI.
 */
import { CLI_TOP_LEVEL_NAMES } from "./cliHelp.js";

const TOP_LEVEL = CLI_TOP_LEVEL_NAMES;

const SUBCOMMANDS: Record<string, readonly string[]> = {
  records: ["list"],
  folders: ["list"],
};

const HELP_FLAGS = ["--help", "-h"] as const;

/** Long/short flags after a command (plus universal --help / -h). */
const FLAG_OPTIONS: Record<string, readonly string[]> = {
  login: [
    "--user",
    "--username",
    "--session-token",
    "--token",
    "--st",
    "--session-token-plain",
  ],
  mkdir: ["-p", "--parents"],
  "register-device": [
    "--device-token",
    "--dt",
    "--private-key",
    "--pk",
    "--user",
    "--username",
  ],
};

function flagsFor(cmd: string): readonly string[] {
  const extra = FLAG_OPTIONS[cmd] ?? [];
  return [...HELP_FLAGS, ...extra];
}

export type CliCompleteResult = {
  /** Line prefix to keep; replacement segment is `line.slice(base.length)`. */
  base: string;
  /** Suggested full tokens (each replaces the partial segment). */
  candidates: string[];
};

/**
 * @param line - Current input (cursor treated as end of line).
 */
export function completeCliLine(line: string): CliCompleteResult {
  const completesNewWord = /\s$/.test(line);
  const segments = line.match(/\S+/g) ?? [];

  let words: string[];
  let stub: string;

  if (completesNewWord) {
    words = [...segments];
    stub = "";
  } else if (segments.length === 0) {
    words = [];
    stub = "";
  } else {
    words = segments.slice(0, -1);
    stub = segments[segments.length - 1] ?? "";
  }

  const lc = (s: string) => s.toLowerCase();
  const stubLc = lc(stub);

  const baseFor = (partialLen: number) =>
    partialLen > 0 ? line.slice(0, line.length - partialLen) : line;

  if (words.length === 0) {
    const hits = TOP_LEVEL.filter((c) => c.startsWith(stubLc));
    return { base: baseFor(stub.length), candidates: hits };
  }

  const cmd = lc(words[0]);

  if (words.length === 1) {
    if (stub.startsWith("-")) {
      const hits = flagsFor(cmd).filter((f) => lc(f).startsWith(stubLc));
      return { base: baseFor(stub.length), candidates: hits };
    }
    const subs = SUBCOMMANDS[cmd];
    if (subs) {
      const hits = subs.filter((s) => lc(s).startsWith(stubLc));
      return { base: baseFor(stub.length), candidates: hits };
    }
    if (completesNewWord || stub.length > 0) {
      const hits = flagsFor(cmd).filter((f) => lc(f).startsWith(stubLc));
      return { base: baseFor(stub.length), candidates: hits };
    }
  }

  return { base: line, candidates: [] };
}
