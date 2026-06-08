import { SdkDefaults } from "@keeper-security/keeper-sdk-javascript";
import shellPkg from "../../package.json";

const ESC = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  yellow: "\x1b[93m",
  green: "\x1b[32m",
  white: "\x1b[97m",
};

export type ShellWelcomeOptions = {
  cols: number;
  loggedIn: boolean;
  keeperHost?: string;
  shellVersion?: string;
  sdkVersion?: string;
};

/** Keeper lock + tagline (Commander display.welcome lines 1–7). */
const KEEPER_ART = [
  "         /#############/   /#\\ ",
  "        /#############/   /###\\      _    __  _______  _______  ______   _______  ______ (R)",
  "       /#############/   /#####\\    | |  / / |  ____/ |  ____/ |  ___ \\ |  ____/ |  ___ \\ ",
  "      /######/           \\######\\   | | / /  | |____  | |____  | | __| || |____  | | __| | ",
  "     /######/             \\######\\  | |< <   |  ___/  |  ___/  | |/___/ |  ___/  | |/_  / ",
  "    /######/               \\######\\ | | \\ \\  | |_____ | |_____ | |      | |_____ | |  \\ \\ ",
  "    \\######\\               /######/ |_|  \\_\\ |_______||_______||_|      |_______||_|   \\_\\ ",
] as const;

/** Dual-banner rows (lock prefix + Commander word art), Commander lines 8–12. */
const DUAL_BANNER_ROWS: ReadonlyArray<readonly [string, string]> = [
  ["     \\######\\             /######/", "     ____                                          _ "],
  ["      \\######\\           /######/ ", "   /  ___|___  _ __ ___  _ __ ___   __ _ _ __   __| | ___ _ __ "],
  ["       \\#############\\   \\#####/  ", "  /  /   / _ \\| '_ ` _ \\| '_ ` _ \\ / _` | '_ \\ / _` |/ _ \\ '__| "],
  ["        \\#############\\   \\###/   ", "  \\  \\__| (_) | | | | | | | | | | | (_| | | | | (_| |  __/ | "],
  ["         \\#############\\   \\#/    ", "   \\_____\\___/|_| |_| |_|_| |_| |_|\\__,_|_| |_|\\__,_|\\___|_| "],
] as const;

/** Narrow terminal: lock graphic only (leading spaces preserved). */
const NARROW_LOCK_ART = [
  "         /#############/   /#\\ ",
  "        /#############/   /###\\",
  "       /#############/   /#####\\",
  "      /######/           \\######\\",
  "     /######/             \\######\\",
  "    /######/               \\######\\",
  "    \\######\\               /######/",
  "     \\######\\             /######/",
  "      \\######\\           /######/ ",
  "       \\#############\\   \\#####/  ",
  "        \\#############\\   \\###/   ",
  "         \\#############\\   \\#/    ",
] as const;

type BannerTier = "wide" | "narrow" | "minimal";

/** Full dual banner needs ~118 cols; below that use lock-only art. */
const TIER_WIDE_COLS = 118;
const TIER_NARROW_COLS = 48;

const COMMANDER_VERSION_ALIGN_COL = 93;

function bannerTier(cols: number): BannerTier {
  if (cols >= TIER_WIDE_COLS) return "wide";
  if (cols >= TIER_NARROW_COLS) return "narrow";
  return "minimal";
}

/** Truncate at terminal edge only — never trim leading spaces (ASCII art alignment). */
function fitArtLine(line: string, cols: number): string {
  return line.length > cols ? line.slice(0, cols) : line;
}

/** Word-wrap prose only (not ASCII art). */
export function wrapPlainText(text: string, cols: number): string[] {
  const width = Math.max(cols, 16);
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= width) return [trimmed];

  const words = trimmed.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (word.length > width) {
      if (current) {
        lines.push(current);
        current = "";
      }
      for (let i = 0; i < word.length; i += width) {
        lines.push(word.slice(i, i + width));
      }
      continue;
    }
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > width) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function yellow(text: string): string {
  return `${ESC.yellow}${text}${ESC.reset}`;
}

function white(text: string): string {
  return `${ESC.white}${text}${ESC.reset}`;
}

function dim(text: string): string {
  return `${ESC.dim}${text}${ESC.reset}`;
}

/** Commander display.welcome dual-line logic (truncate, never reflow). */
function pushDualRow(out: string[], left: string, right: string, cols: number): void {
  let yellowLine = left;
  let whiteLine = right;
  if (yellowLine.length > cols) {
    yellowLine = yellowLine.slice(0, cols);
  }
  if (yellowLine.length + whiteLine.length > cols) {
    if (yellowLine.length < cols) {
      whiteLine = whiteLine.slice(0, cols - yellowLine.length);
    } else {
      whiteLine = "";
    }
  }
  if (whiteLine) {
    out.push(`${ESC.yellow}${yellowLine}${ESC.white}${whiteLine}${ESC.reset}`);
  } else {
    out.push(yellow(yellowLine));
  }
}

/** Responsive Commander banner — preserves fixed-width ASCII alignment. */
export function bannerLines(cols: number): string[] {
  const width = Math.max(cols, 24);
  const tier = bannerTier(width);
  const out: string[] = [];

  if (tier === "minimal") {
    out.push(yellow("Keeper Commander Shell"));
    return out;
  }

  if (tier === "narrow") {
    for (const line of NARROW_LOCK_ART) {
      out.push(yellow(fitArtLine(line, width)));
    }
    out.push(white(fitArtLine("Commander", width)));
    return out;
  }

  for (const line of KEEPER_ART) {
    out.push(yellow(fitArtLine(line, width)));
  }
  for (const [left, right] of DUAL_BANNER_ROWS) {
    pushDualRow(out, left, right, width);
  }
  return out;
}

function versionLine(shellVersion: string, sdkVersion: string, cols: number): string {
  const label = `v${shellVersion} · SDK ${sdkVersion}`;
  if (cols < 48) return dim(label);
  const alignTo = Math.min(COMMANDER_VERSION_ALIGN_COL, cols);
  const pad = Math.max(0, alignTo - label.length);
  return `${ESC.dim}${" ".repeat(pad)}${label}${ESC.reset}`;
}

function notLoggedInMessages(cols: number, keeperHost?: string): string[] {
  const out: string[] = [];
  out.push("You are not logged in.");

  if (keeperHost) {
    out.push(...wrapPlainText(`Region: ${keeperHost}`, cols));
  } else {
    for (const row of wrapPlainText(
      "Set keeper-host on the element (or VITE_KEEPER_HOST) to override the default region.",
      cols
    )) {
      out.push(dim(row));
    }
  }

  if (cols >= 100) {
    out.push(
      `Type ${ESC.green}login <email>${ESC.reset} to authenticate, ` +
        `${ESC.green}restore-session${ESC.reset} to resume, or ` +
        `${ESC.green}register-device${ESC.reset} for token login.`
    );
  } else {
    out.push(`Type ${ESC.green}login <email>${ESC.reset} to authenticate.`);
    out.push(
      `${ESC.green}restore-session${ESC.reset} to resume, or ` +
        `${ESC.green}register-device${ESC.reset} for token login.`
    );
  }
  out.push(`Type ${ESC.green}help${ESC.reset} or ${ESC.green}?${ESC.reset} for sign-in commands.`);
  return out;
}

function loggedInMessages(cols: number): string[] {
  const out: string[] = [
    `Type ${ESC.green}help${ESC.reset} or ${ESC.green}?${ESC.reset} for available commands.`,
  ];
  for (const row of wrapPlainText(
    "Vault shell — get, ls, cd, tree, search, sync-down (see COMMAND --help).",
    cols
  )) {
    out.push(dim(row));
  }
  return out;
}

/** Commander-style startup banner + session hint (browser shell). */
export function buildShellWelcomeLines(options: ShellWelcomeOptions): string[] {
  const cols = Math.max(options.cols, 24);
  const shellVersion = options.shellVersion ?? shellPkg.version;
  const sdkVersion = options.sdkVersion ?? SdkDefaults.CLIENT_VERSION;
  const lines: string[] = [""];

  lines.push(...bannerLines(cols));
  lines.push(versionLine(shellVersion, sdkVersion, cols));
  lines.push("");

  if (!options.loggedIn) {
    lines.push(...notLoggedInMessages(cols, options.keeperHost));
  } else {
    lines.push(...loggedInMessages(cols));
  }

  lines.push("");
  return lines;
}

export function writeShellWelcome(
  write: (line: string) => void,
  options: ShellWelcomeOptions
): void {
  for (const line of buildShellWelcomeLines(options)) {
    write(line);
  }
}
