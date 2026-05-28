/**
 * Tab-completion for keeper-shell (SDK command registry).
 */
import { getCliCommand, listCliCommandNames } from "@keeper-security/keeper-sdk-javascript";

const HELP_FLAGS = ["--help", "-h"] as const;

function flagsFor(cmd: string): readonly string[] {
  const def = getCliCommand(cmd);
  const extra = def?.flagOptions ?? [];
  return [...HELP_FLAGS, ...extra];
}

export type CliCompleteResult = {
  base: string;
  candidates: string[];
};

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
    const top = listCliCommandNames();
    const hits = top.filter((c) => c.startsWith(stubLc));
    return { base: baseFor(stub.length), candidates: hits };
  }

  const cmd = lc(words[0]);
  const def = getCliCommand(cmd);

  if (words.length === 1) {
    if (stub.startsWith("-")) {
      const hits = flagsFor(cmd).filter((f) => lc(f).startsWith(stubLc));
      return { base: baseFor(stub.length), candidates: [...hits] };
    }
    const subs = def?.subcommands;
    if (subs?.length) {
      const hits = subs.filter((s) => lc(s).startsWith(stubLc));
      if (hits.length > 0) {
        return { base: baseFor(stub.length), candidates: [...hits] };
      }
    }
    if (completesNewWord || stub.length > 0) {
      const hits = flagsFor(cmd).filter((f) => lc(f).startsWith(stubLc));
      return { base: baseFor(stub.length), candidates: [...hits] };
    }
  }

  if (words.length >= 2 && def?.subcommands) {
    const subLc = lc(words[1]);
    const knownSub = def.subcommands.some((s) => lc(s) === subLc);
    if (knownSub && (stub.startsWith("-") || completesNewWord)) {
      const hits = flagsFor(cmd).filter((f) => lc(f).startsWith(stubLc));
      return { base: baseFor(stub.length), candidates: [...hits] };
    }
  }

  if (words.length >= 2 && !def?.subcommands && (stub.startsWith("-") || completesNewWord)) {
    const hits = flagsFor(cmd).filter((f) => lc(f).startsWith(stubLc));
    if (hits.length > 0) {
      return { base: baseFor(stub.length), candidates: [...hits] };
    }
  }

  return { base: line, candidates: [] };
}
