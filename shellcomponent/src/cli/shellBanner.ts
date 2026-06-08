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

const COMMANDER_LOCK_PREFIX = [
  "     \\######\\             /######/",
  "      \\######\\           /######/ ",
  "       \\#############\\   \\#####/  ",
  "        \\#############\\   \\###/   ",
  "         \\#############\\   \\#/    ",
] as const;

const COMMANDER_WORD_ART = [
  "     ____                                          _ ",
  "   /  ___|___  _ __ ___  _ __ ___   __ _ _ __   __| | ___ _ __ ",
  "  /  /   / _ \\| '_ ` _ \\| '_ ` _ \\ / _` | '_ \\ / _` |/ _ \\ '__| ",
  "  \\  \\__| (_) | | | | | | | | | | | (_| | | | | (_| |  __/ | ",
  "   \\_____\\___/|_| |_| |_|_| |_| |_|\\__,_|_| |_|\\__,_|\\___|_| ",
] as const;

/** Short lock-only stack for compact terminals. */
const COMPACT_LOCK = [
  "    /#############/   /#\\",
  "   /#############/   /###\\",
  "  /#############/   /#####\\",
  " /######/         \\######\\",
  " \\######\\         /######/",
] as const;

/** Chars of KEEPER_ART lines that are the lock graphic (tagline is to the right). */
const KEEPER_LOCK_CHARS = 38;

type BannerTier = "wide" | "medium" | "compact" | "minimal";

const TIER_WIDE_COLS = 118;
const TIER_MEDIUM_COLS = 80;
const TIER_COMPACT_COLS = 52;

function bannerTier(cols: number): BannerTier {
  if (cols >= TIER_WIDE_COLS) return "wide";
  if (cols >= TIER_MEDIUM_COLS) return "medium";
  if (cols >= TIER_COMPACT_COLS) return "compact";
  return "minimal";
}

/** Word-wrap plain text to terminal width (rolls down instead of truncating). */
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

function keeperLockPortion(line: string): string {
  return line.slice(0, KEEPER_LOCK_CHARS).trimEnd();
}

function pushArtLines(out: string[], art: readonly string[], cols: number): void {
  for (const line of art) {
    for (const row of wrapPlainText(line, cols)) {
      out.push(yellow(row));
    }
  }
}

/** Responsive Commander banner — stacks vertically on narrow terminals. */
export function bannerLines(cols: number): string[] {
  const width = Math.max(cols, 24);
  const tier = bannerTier(width);
  const out: string[] = [];

  if (tier === "minimal") {
    out.push(yellow("Keeper Commander Shell"));
    return out;
  }

  if (tier === "compact") {
    pushArtLines(out, COMPACT_LOCK, width);
    out.push(white("Commander"));
    return out;
  }

  if (tier === "medium") {
    for (const line of KEEPER_ART) {
      const lock = keeperLockPortion(line);
      if (lock) out.push(yellow(lock));
    }
    for (let i = 0; i < COMMANDER_LOCK_PREFIX.length; i++) {
      const lock = keeperLockPortion(COMMANDER_LOCK_PREFIX[i]);
      if (lock) out.push(yellow(lock));
      const word = COMMANDER_WORD_ART[i] ?? "";
      for (const row of wrapPlainText(word, width)) {
        if (row.trim()) out.push(white(row));
      }
    }
    return out;
  }

  // wide — dual layout when each combined line fits; otherwise stack per line
  for (const line of KEEPER_ART) {
    for (const row of wrapPlainText(line, width)) {
      out.push(yellow(row));
    }
  }
  for (let i = 0; i < COMMANDER_LOCK_PREFIX.length; i++) {
    const left = COMMANDER_LOCK_PREFIX[i];
    const right = COMMANDER_WORD_ART[i] ?? "";
    if (left.length + right.length <= width) {
      out.push(`${ESC.yellow}${left}${ESC.white}${right}${ESC.reset}`);
    } else {
      for (const row of wrapPlainText(left, width)) {
        out.push(yellow(row));
      }
      for (const row of wrapPlainText(right, width)) {
        if (row.trim()) out.push(white(row));
      }
    }
  }
  return out;
}

function versionLine(shellVersion: string, sdkVersion: string, cols: number): string {
  const label = `v${shellVersion} · SDK ${sdkVersion}`;
  if (cols < 72) return dim(label);
  const pad = Math.max(0, cols - label.length);
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

  if (cols >= 80) {
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
