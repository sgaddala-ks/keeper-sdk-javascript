import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import xtermCss from "@xterm/xterm/css/xterm.css?inline";

import { completeCliLine } from "./cli/cliComplete.js";
import { dispatchCliLine } from "./cli/cliDispatch.js";
import { setShellCliContext } from "./cli/cliContext.js";
import { loginWithCredentials, resetShellVault } from "./cli/keeperCommands.js";

export const KEEPER_SHELL_TAG = "keeper-shell";
/** Legacy custom element name (same behavior as {@link KEEPER_SHELL_TAG}). */
export const WEB_CONSOLE_TAG = "web-console";

const ATTR_API_BASE = "api-base";
const ATTR_KEEPER_HOST = "keeper-host";
const ATTR_COLLAPSED = "collapsed";
const ATTR_HEIGHT = "height";
/** When set, CLI uses HTTP (POST `${apiBase}/cli`, …). Omitted = in-browser Keeper SDK (default for prod FE). */
const ATTR_REMOTE = "remote";
/** @deprecated Prefer default in-browser mode; `local` removes the `remote` attribute when set via property. */
const ATTR_LOCAL = "local";
/** Full in-page terminal only (no show/hide button). */
const ATTR_EMBED = "embed";
/** When set, each new `$ ` prompt starts with masked input (`*` display). Toggle with Ctrl+O. */
const ATTR_MASK_INPUT = "mask-input";

/** Same as legacy `<web-console>`: default `/api` when attribute is missing. */
function normalizeApiBase(raw: string | null): string {
  const s = (raw ?? "/api").trim() || "/api";
  return s.replace(/\/$/, "") || "/api";
}

/** Resolved at build time; change `../icon.jpg` if the asset moves. */
const CONSOLE_TOGGLE_ICON_URL = new URL("../icon.jpg", import.meta.url).href;

/** Same bitmap for both states; `aria-label` / `title` reflect expand vs collapse. */
function setConsoleToggleButtonUi(btn: HTMLButtonElement, collapsed: boolean): void {
  const label = collapsed ? "Open console" : "Hide console";
  btn.setAttribute("aria-label", label);
  btn.title = label;
  btn.innerHTML = `<img class="wc-toggle-icon" src="${CONSOLE_TOGGLE_ICON_URL}" alt="" width="22" height="22" decoding="async" draggable="false" />`;
}

type CliResponse = {
  out?: string;
  err?: string;
  error?: string;
  code?: number;
  needPassword?: boolean;
  loginUsername?: string;
};

type CompleteResponse = { base?: unknown; candidates?: unknown };

const REMOTE_ERROR_BODY_MAX = 2000;

/** Parse JSON from a remote CLI response; otherwise return a text preview (e.g. HTML 500 page). */
async function readRemoteJsonBody<T extends object = CliResponse>(res: Response): Promise<
  { kind: "json"; data: T } | { kind: "plain"; preview: string }
> {
  const raw = await res.text();
  const t = raw.trim();
  if (t.length === 0) {
    return { kind: "json", data: {} as T };
  }
  try {
    return { kind: "json", data: JSON.parse(t) as T };
  } catch {
    const preview =
      raw.length > REMOTE_ERROR_BODY_MAX ? raw.slice(0, REMOTE_ERROR_BODY_MAX) + "\n… (truncated)" : raw;
    return { kind: "plain", preview };
  }
}

const JSON_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json",
} as const;

/** JSON body for POST …/cli and …/cli/complete (`command` mirrors common server field names). */
function remoteCliExecuteBody(line: string): string {
  return JSON.stringify({ line, command: line });
}

function formatErr(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function longestCommonPrefix(values: string[]): string {
  if (values.length === 0) return "";
  let pref = values[0];
  for (let i = 1; i < values.length; i++) {
    const s = values[i];
    let j = 0;
    const n = Math.min(pref.length, s.length);
    while (j < n && pref[j] === s[j]) j++;
    pref = pref.slice(0, j);
    if (pref === "") break;
  }
  return pref;
}

/** Parsed stdin tokens from xterm (arrow keys arrive as ESC sequences). */
type InputTok =
  | { k: "c"; v: string }
  | { k: "up" }
  | { k: "down" }
  | { k: "left" }
  | { k: "right" }
  | { k: "del" };

function feedInput(chunk: string, carry: { s: string }): InputTok[] {
  const s = carry.s + chunk;
  carry.s = "";
  const out: InputTok[] = [];
  let i = 0;
  while (i < s.length) {
    if (s.charCodeAt(i) !== 0x1b) {
      out.push({ k: "c", v: s[i] });
      i++;
      continue;
    }
    if (i + 1 >= s.length) {
      carry.s = s.slice(i);
      break;
    }
    const c1 = s[i + 1];
    if (c1 === "[") {
      let j = i + 2;
      let foundFinal = false;
      while (j < s.length) {
        const code = s.charCodeAt(j);
        if (code >= 0x40 && code <= 0x7e) {
          foundFinal = true;
          const fn = s[j];
          const param = s.slice(i + 2, j);
          if (fn === "A") out.push({ k: "up" });
          else if (fn === "B") out.push({ k: "down" });
          else if (fn === "C") out.push({ k: "right" });
          else if (fn === "D") out.push({ k: "left" });
          else if (fn === "~" && param === "3") out.push({ k: "del" });
          i = j + 1;
          break;
        }
        j++;
      }
      if (!foundFinal) {
        carry.s = s.slice(i);
        break;
      }
      continue;
    }
    if (c1 === "O") {
      if (i + 2 >= s.length) {
        carry.s = s.slice(i);
        break;
      }
      const c2 = s[i + 2];
      if (c2 === "A") out.push({ k: "up" });
      else if (c2 === "B") out.push({ k: "down" });
      else if (c2 === "C") out.push({ k: "right" });
      else if (c2 === "D") out.push({ k: "left" });
      else {
        out.push({ k: "c", v: "\x1b" });
        i++;
        continue;
      }
      i += 3;
      continue;
    }
    out.push({ k: "c", v: "\x1b" });
    i++;
  }
  return out;
}

export class KeeperShell extends HTMLElement {
  static observedAttributes = [
    ATTR_API_BASE,
    ATTR_KEEPER_HOST,
    ATTR_COLLAPSED,
    ATTR_HEIGHT,
    ATTR_REMOTE,
    ATTR_LOCAL,
    ATTR_EMBED,
    ATTR_MASK_INPUT,
  ];

  private _term: Terminal | null = null;
  private _fit: FitAddon | null = null;
  private _ro: ResizeObserver | null = null;
  private _onWinResize: (() => void) | null = null;
  private _chain: Promise<void> = Promise.resolve();
  private _lineBuf = "";
  private _started = false;
  private _completing = false;
  private _inputListeners: AbortController | null = null;

  constructor() {
    super();
    // Lets the browser delegate focus to the xterm textarea inside shadow (keyboard input).
    this.attachShadow({ mode: "open", delegatesFocus: true });
  }

  /**
   * Base URL for CLI HTTP transport (no trailing slash). POST `${apiBase}/cli`, etc.
   * Default `/api` when the attribute is omitted (legacy web-console behavior).
   */
  get apiBase(): string {
    return normalizeApiBase(this.getAttribute(ATTR_API_BASE));
  }

  set apiBase(v: string) {
    this.setAttribute(ATTR_API_BASE, (v && v.trim()) || "/api");
  }

  get keeperHost(): string {
    return (this.getAttribute(ATTR_KEEPER_HOST) || "").trim();
  }

  set keeperHost(v: string) {
    if (!v.trim()) this.removeAttribute(ATTR_KEEPER_HOST);
    else this.setAttribute(ATTR_KEEPER_HOST, v);
  }

  get collapsed(): boolean {
    return this.hasAttribute(ATTR_COLLAPSED);
  }

  set collapsed(v: boolean) {
    if (v) this.setAttribute(ATTR_COLLAPSED, "");
    else this.removeAttribute(ATTR_COLLAPSED);
  }

  get maskInput(): boolean {
    return this.hasAttribute(ATTR_MASK_INPUT);
  }

  set maskInput(v: boolean) {
    if (v) this.setAttribute(ATTR_MASK_INPUT, "");
    else this.removeAttribute(ATTR_MASK_INPUT);
  }

  /**
   * When set, CLI uses HTTP: POST `${apiBase}/cli`, etc.
   * When omitted (default), input is handled in-browser (parser + Keeper SDK).
   */
  get remote(): boolean {
    return this.hasAttribute(ATTR_REMOTE);
  }

  set remote(v: boolean) {
    if (v) this.setAttribute(ATTR_REMOTE, "");
    else this.removeAttribute(ATTR_REMOTE);
  }

  /**
   * @deprecated Use {@link remote} instead. `local === !remote` (setting `local` removes `remote`).
   */
  get local(): boolean {
    return !this.remote;
  }

  set local(v: boolean) {
    if (v) this.removeAttribute(ATTR_REMOTE);
    else this.setAttribute(ATTR_REMOTE, "");
  }

  /** Browser CLI layout: terminal fills the element; no collapsible chrome. */
  get embed(): boolean {
    return this.hasAttribute(ATTR_EMBED);
  }

  set embed(v: boolean) {
    if (v) this.setAttribute(ATTR_EMBED, "");
    else this.removeAttribute(ATTR_EMBED);
  }

  private _isLocal(): boolean {
    return !this.hasAttribute(ATTR_REMOTE);
  }

  private _isEmbed(): boolean {
    return this.hasAttribute(ATTR_EMBED);
  }

  /** `null` → in-browser CLI; else HTTP prefix (default `/api`). */
  private _remoteApiPrefix(): string | null {
    if (this._isLocal()) return null;
    return normalizeApiBase(this.getAttribute(ATTR_API_BASE));
  }

  private _syncShellContext(): void {
    const h = this.getAttribute(ATTR_KEEPER_HOST)?.trim();
    setShellCliContext({ keeperHost: h || undefined });
    if (this._isLocal()) {
      resetShellVault();
    }
  }

  attributeChangedCallback(name: string, _old: string | null, val: string | null): void {
    if (name === ATTR_HEIGHT && this.shadowRoot && !this._isEmbed()) {
      const host = this.shadowRoot.querySelector(".wc-terminal-host");
      if (host instanceof HTMLElement) host.style.height = val || "320px";
    }
    if (name === ATTR_KEEPER_HOST) {
      this._syncShellContext();
    }
    if (name === ATTR_EMBED || name === ATTR_LOCAL || name === ATTR_REMOTE) {
      if (name === ATTR_LOCAL || name === ATTR_REMOTE) this._syncShellContext();
      const shouldShow = this._isEmbed() || !this.collapsed;
      if (this._started) this._teardownTerminal();
      this._renderShell();
      this._wireChrome();
      if (shouldShow) this._mountTerminal();
      return;
    }
    if (name === ATTR_COLLAPSED && !this._isEmbed() && this.shadowRoot) {
      const panel = this.shadowRoot.querySelector(".wc-panel");
      const btn = this.shadowRoot.querySelector(".wc-toggle");
      if (this.collapsed) {
        panel?.setAttribute("hidden", "");
        if (btn instanceof HTMLButtonElement) setConsoleToggleButtonUi(btn, true);
        this._teardownTerminal();
      } else {
        panel?.removeAttribute("hidden");
        if (btn instanceof HTMLButtonElement) setConsoleToggleButtonUi(btn, false);
        this._mountTerminal();
      }
      this._applyHostShellMinHeight();
    }
  }

  connectedCallback(): void {
    if (!this.shadowRoot) return;
    while (this.firstChild) {
      this.removeChild(this.firstChild);
    }
    // Do not make the host a tab stop — xterm's inner textarea (`.wc-terminal-host`, tabindex=0) must receive keys.
    this.tabIndex = -1;
    this.setAttribute("role", "application");
    this.setAttribute("aria-label", "Keeper CLI");
    this._syncShellContext();
    this._renderShell();
    this._wireChrome();
    if (this._isEmbed() || !this.collapsed) {
      this._mountTerminal();
    }
  }

  disconnectedCallback(): void {
    this._teardownTerminal();
  }

  private _wireChrome(): void {
    if (!this.shadowRoot || this._isEmbed()) return;
    const btn = this.shadowRoot.querySelector(".wc-toggle");
    if (!(btn instanceof HTMLButtonElement)) return;
    btn.addEventListener("click", () => this._toggle());
  }

  private _toggle(): void {
    if (this._isEmbed()) return;
    const panel = this.shadowRoot?.querySelector(".wc-panel");
    const btn = this.shadowRoot?.querySelector(".wc-toggle");
    if (!(panel instanceof HTMLElement) || !(btn instanceof HTMLButtonElement)) return;
    const hidden = panel.hasAttribute("hidden");
    if (hidden) {
      panel.removeAttribute("hidden");
      setConsoleToggleButtonUi(btn, false);
      this._mountTerminal();
    } else {
      panel.setAttribute("hidden", "");
      setConsoleToggleButtonUi(btn, true);
      this._teardownTerminal();
    }
    this._applyHostShellMinHeight();
  }

  /** When the panel is hidden, avoid reserving terminal height so the page stays compact. */
  private _applyHostShellMinHeight(): void {
    if (this._isEmbed()) return;
    const panel = this.shadowRoot?.querySelector(".wc-panel");
    const panelHidden = panel?.hasAttribute("hidden");
    const h = (this.getAttribute(ATTR_HEIGHT) || "320px").trim();
    if (panelHidden) {
      this.style.minHeight = "auto";
      return;
    }
    if (/^\d+(\.\d+)?px$/.test(h) || /^\d+(\.\d+)?rem$/.test(h)) {
      this.style.minHeight = `calc(${h} + 3.75rem)`;
    } else {
      this.style.minHeight = "min(90vh, 28rem)";
    }
  }

  private _renderShell(): void {
    const height = this.getAttribute(ATTR_HEIGHT) || "320px";
    if (!this.shadowRoot) return;
    this.shadowRoot.innerHTML = "";

    const style = document.createElement("style");
    const embed = this._isEmbed();

    if (embed) {
      style.textContent = `
      ${xtermCss}
      :host {
        display: flex;
        flex-direction: column;
        width: 100%;
        min-height: ${height};
        box-sizing: border-box;
        font-family: system-ui, sans-serif;
        pointer-events: auto;
      }
      .wc-root {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
        padding: 0;
        pointer-events: auto;
      }
      .wc-panel {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
        margin: 0;
        pointer-events: auto;
        border: 2px solid #3d3d3d;
        border-radius: 0;
        overflow: hidden;
        background: #121212 !important;
        background-color: #121212 !important;
      }
      .wc-cli-cap {
        flex-shrink: 0;
        padding: 6px 12px;
        font-size: 12px;
        font-weight: 600;
        color: #c8c8c8;
        background: #1e1e1e !important;
        border-bottom: 1px solid #404040;
        user-select: none;
      }
      .wc-terminal-host {
        flex: 1;
        min-height: ${height};
        min-width: 280px;
        width: 100%;
        box-sizing: border-box;
        padding: 6px 0;
        position: relative;
        cursor: text;
        outline: none;
        background: #0b0b0b !important;
        background-color: #0b0b0b !important;
        pointer-events: auto;
      }
      .wc-terminal-host .xterm { height: 100%; background-color: #0b0b0b !important; pointer-events: auto; }
      .wc-terminal-host .xterm-viewport { background-color: #0b0b0b !important; }
      .wc-terminal-host .xterm-screen { background-color: #0b0b0b !important; }
    `;
    } else {
      style.textContent = `
      ${xtermCss}
      :host {
        display: block;
        width: 100%;
        box-sizing: border-box;
        font-family: system-ui, sans-serif;
        min-height: calc(${height} + 3.75rem);
        pointer-events: auto;
      }
      .wc-root {
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 0;
        pointer-events: auto;
      }
      .wc-root:has(.wc-panel:not([hidden])) {
        padding-bottom: 48px;
      }
      .wc-toggle {
        box-sizing: border-box;
        width: 30px;
        height: 30px;
        padding: 0;
        margin: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 0;
        cursor: pointer;
        border-radius: 6px;
        border: 1px solid #c4c4c4;
        background: #f0f0f0;
        color: #2a2a2a;
        flex-shrink: 0;
        position: fixed;
        bottom: 12px;
        left: 12px;
        z-index: 10000;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
      }
      .wc-toggle:hover {
        background: #e4e4e4;
        border-color: #a8a8a8;
      }
      .wc-toggle:focus-visible {
        outline: 2px solid #2563eb;
        outline-offset: 2px;
      }
      .wc-toggle-icon {
        display: block;
        width: 22px;
        height: 22px;
        object-fit: contain;
        flex-shrink: 0;
        pointer-events: none;
        user-select: none;
      }
      .wc-panel {
        margin-top: 0;
        display: flex;
        flex-direction: column;
        border: 2px solid #3d3d3d;
        border-radius: 10px;
        overflow: hidden;
        background: #121212 !important;
        background-color: #121212 !important;
        box-shadow: 0 2px 12px rgba(0,0,0,0.25);
        pointer-events: auto;
      }
      .wc-panel[hidden] { display: none; }
      .wc-cli-cap {
        flex-shrink: 0;
        padding: 6px 12px;
        font-size: 12px;
        font-weight: 600;
        color: #c8c8c8;
        background: #1e1e1e !important;
        border-bottom: 1px solid #404040;
        user-select: none;
      }
      .wc-terminal-host {
        flex: 1;
        min-height: ${height};
        min-width: 280px;
        width: 100%;
        box-sizing: border-box;
        padding: 6px 0;
        position: relative;
        cursor: text;
        outline: none;
        background: #0b0b0b !important;
        background-color: #0b0b0b !important;
        pointer-events: auto;
      }
      .wc-terminal-host .xterm { height: 100%; background-color: #0b0b0b !important; pointer-events: auto; }
      .wc-terminal-host .xterm-viewport { background-color: #0b0b0b !important; }
      .wc-terminal-host .xterm-screen { background-color: #0b0b0b !important; }
    `;
    }

    const root = document.createElement("div");
    root.className = "wc-root";

    const panel = document.createElement("div");
    panel.className = "wc-panel";
    if (!embed && this.collapsed) panel.setAttribute("hidden", "");

    const cap = document.createElement("div");
    cap.className = "wc-cli-cap";
    cap.textContent = this.remote
      ? `Keeper CLI — HTTP (${this.apiBase})`
      : "Keeper CLI — in-browser SDK (click in the terminal, then type)";

    const host = document.createElement("div");
    host.className = "wc-terminal-host";
    if (!embed) {
      host.style.height = height;
    }
    host.style.backgroundColor = "#0b0b0b";

    panel.appendChild(cap);
    panel.appendChild(host);

    if (!embed) {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "wc-toggle";
      setConsoleToggleButtonUi(toggle, this.collapsed);
      root.appendChild(panel);
      root.appendChild(toggle);
    } else {
      root.appendChild(panel);
    }
    this.shadowRoot.append(style, root);

    if (!embed) {
      this.style.display = "block";
      this.style.width = "100%";
      this.style.boxSizing = "border-box";
      this._applyHostShellMinHeight();
    } else {
      this.style.minHeight = "100%";
      this.style.display = "block";
      this.style.width = "100%";
      this.style.boxSizing = "border-box";
    }
  }

  private _mountTerminal(): void {
    if (this._started) return;
    const host = this.shadowRoot?.querySelector(".wc-terminal-host");
    if (!(host instanceof HTMLElement)) return;

    const term = new Terminal({
      allowTransparency: false,
      cursorBlink: true,
      convertEol: true,
      fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
      fontSize: 14,
      theme: {
        background: "#0b0b0b",
        foreground: "#eaeaea",
        cursor: "#eaeaea",
      },
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);

    const refit = (): void => {
      try {
        fit.fit();
      } catch {
        /* layout not ready */
      }
    };

    /** xterm FitAddon yields 0×0 if the container has no layout box yet. */
    const ensureUsableGeometry = (): void => {
      refit();
      if (term.cols < 2 || term.rows < 1) {
        try {
          term.resize(80, 24);
        } catch {
          /* ignore */
        }
      }
    };

    ensureUsableGeometry();
    requestAnimationFrame(() => {
      ensureUsableGeometry();
      requestAnimationFrame(() => {
        ensureUsableGeometry();
        term.focus();
      });
    });

    host.tabIndex = 0;
    host.setAttribute("aria-label", "Command line");
    const focusTerm = (): void => {
      term.focus();
    };
    this._inputListeners?.abort();
    this._inputListeners = new AbortController();
    const sig = this._inputListeners.signal;
    host.addEventListener("pointerdown", focusTerm, { signal: sig });
    host.addEventListener("focusin", focusTerm, { signal: sig });
    this.addEventListener(
      "focusin",
      (ev) => {
        if (ev.target === this) focusTerm();
      },
      { signal: sig }
    );

    this._term = term;
    this._fit = fit;
    this._started = true;
    this._lineBuf = "";

    const HISTORY_MAX = 500;
    const history: string[] = [];
    const inputCarry = { s: "" };
    let histFromEnd = -1;
    let histDraft = "";
    let cursorPos = 0;
    let maskSensitive = this.hasAttribute(ATTR_MASK_INPUT);
    let pendingLoginUsername: string | null = null;

    const maskDisplayActive = (): boolean =>
      maskSensitive || pendingLoginUsername !== null;

    const resetMaskAfterPasswordFlow = (): void => {
      maskSensitive = this.hasAttribute(ATTR_MASK_INPUT);
    };

    const afterNewPrompt = (): void => {
      if (this.hasAttribute(ATTR_MASK_INPUT)) maskSensitive = true;
    };

    const writeFreshPrompt = (): void => {
      term.write("$ ");
      afterNewPrompt();
    };

    const writePromptLine = (): void => {
      const line = this._lineBuf;
      if (cursorPos < 0) cursorPos = 0;
      if (cursorPos > line.length) cursorPos = line.length;
      const visible = maskDisplayActive() ? "*".repeat(line.length) : line;
      term.write(`\r\x1b[2K$ ${visible}`);
      const back = line.length - cursorPos;
      if (back > 0) term.write(`\x1b[${back}D`);
    };

    const resetHistoryNav = (): void => {
      histFromEnd = -1;
    };

    const bumpEditing = (): void => {
      histFromEnd = -1;
    };

    const pushHistoryEntry = (cmd: string): void => {
      if (!cmd) return;
      history.push(cmd);
      if (history.length > HISTORY_MAX) history.shift();
    };

    const historyOlder = (): void => {
      if (history.length === 0) {
        term.write("\x07");
        return;
      }
      if (histFromEnd === -1) {
        histDraft = this._lineBuf;
        histFromEnd = 0;
      } else if (histFromEnd < history.length - 1) {
        histFromEnd++;
      } else {
        term.write("\x07");
        return;
      }
      this._lineBuf = history[history.length - 1 - histFromEnd] ?? "";
      cursorPos = this._lineBuf.length;
      writePromptLine();
    };

    const historyNewer = (): void => {
      if (histFromEnd === -1) {
        return;
      }
      if (histFromEnd > 0) {
        histFromEnd--;
        this._lineBuf = history[history.length - 1 - histFromEnd] ?? "";
        cursorPos = this._lineBuf.length;
        writePromptLine();
        return;
      }
      histFromEnd = -1;
      this._lineBuf = histDraft;
      cursorPos = this._lineBuf.length;
      writePromptLine();
    };

    const runTabComplete = async (): Promise<void> => {
      if (pendingLoginUsername !== null) {
        term.write("\x07");
        return;
      }
      if (this._completing) return;
      this._completing = true;
      try {
        bumpEditing();
        const remote = this._remoteApiPrefix();
        let data: CompleteResponse;
        if (remote === null) {
          data = completeCliLine(this._lineBuf) as CompleteResponse;
        } else {
          const url = `${remote}/cli/complete`;
          const res = await fetch(url, {
            method: "POST",
            headers: JSON_HEADERS,
            body: remoteCliExecuteBody(this._lineBuf),
          });
          const parsed = await readRemoteJsonBody<CompleteResponse>(res);
          if (parsed.kind === "plain") {
            term.write("\x07");
            return;
          }
          data = parsed.data;
          if (!res.ok) {
            term.write("\x07");
            return;
          }
        }
        const base = typeof data.base === "string" ? data.base : "";
        const raw = data.candidates;
        const candidates = Array.isArray(raw)
          ? raw.filter((x): x is string => typeof x === "string")
          : [];
        const partial = this._lineBuf.slice(base.length);

        if (candidates.length === 0) {
          term.write("\x07");
          return;
        }
        if (candidates.length === 1) {
          this._lineBuf = base + candidates[0];
          cursorPos = this._lineBuf.length;
          writePromptLine();
          return;
        }
        const lcp = longestCommonPrefix(candidates);
        if (lcp.length > partial.length) {
          this._lineBuf = base + lcp;
          cursorPos = this._lineBuf.length;
          writePromptLine();
          return;
        }
        term.writeln("");
        term.writeln(`\x1b[90m${candidates.join(" ")}\x1b[0m`);
        writePromptLine();
      } catch {
        term.write("\x07");
      } finally {
        this._completing = false;
      }
    };

    const flushLine = async (): Promise<void> => {
      const cmd = this._lineBuf.trim();
      const skipHistory = maskDisplayActive();
      this._lineBuf = "";
      cursorPos = 0;
      resetHistoryNav();
      histDraft = "";

      if (pendingLoginUsername !== null) {
        if (!cmd) {
          term.writeln("\x1b[31mlogin: password required\x1b[0m");
          writeFreshPrompt();
          return;
        }
        const username = pendingLoginUsername;
        pendingLoginUsername = null;
        term.writeln("\x1b[90mSigning in…\x1b[0m");
        try {
          const remote = this._remoteApiPrefix();
          let data: CliResponse;
          if (remote === null) {
            data = await loginWithCredentials(username, cmd);
          } else {
            const res = await fetch(`${remote}/cli/login`, {
              method: "POST",
              headers: JSON_HEADERS,
              body: JSON.stringify({ username, password: cmd }),
            });
            const parsed = await readRemoteJsonBody(res);
            if (parsed.kind === "plain") {
              term.write(
                `\x1b[31mHTTP ${res.status}: response is not JSON (server error page or non-API response).\n${parsed.preview}\x1b[0m\n`
              );
              resetMaskAfterPasswordFlow();
              writeFreshPrompt();
              return;
            }
            data = parsed.data;
            if (!res.ok) {
              const d = data as CliResponse & { message?: string };
              const parts = [d?.error, d?.err, d?.out, d?.message].filter(
                (x): x is string => typeof x === "string" && x.trim().length > 0
              );
              const msg = parts.length > 0 ? parts.join("\n") : res.statusText || "request failed";
              term.write(`\x1b[31m${msg}\x1b[0m\n`);
              resetMaskAfterPasswordFlow();
              writeFreshPrompt();
              return;
            }
          }
          if (data.out) term.write(data.out);
          if (data.err) term.write(`\x1b[31m${data.err}\x1b[0m`);
        } catch (err) {
          term.write(`\x1b[31mError: ${formatErr(err)}\x1b[0m`);
        }
        resetMaskAfterPasswordFlow();
        writeFreshPrompt();
        return;
      }

      if (!cmd) {
        writeFreshPrompt();
        return;
      }
      if (!skipHistory) pushHistoryEntry(cmd);

      try {
        const remote = this._remoteApiPrefix();
        let data: CliResponse;
        if (remote === null) {
          data = await dispatchCliLine(cmd);
        } else {
          const res = await fetch(`${remote}/cli`, {
            method: "POST",
            headers: JSON_HEADERS,
            body: remoteCliExecuteBody(cmd),
          });
          const parsed = await readRemoteJsonBody(res);
          if (parsed.kind === "plain") {
            term.write(
              `\x1b[31mHTTP ${res.status}: response is not JSON (server error page or non-API response).\n${parsed.preview}\x1b[0m\n`
            );
            writeFreshPrompt();
            return;
          }
          data = parsed.data;
          if (!res.ok) {
            const d = data as CliResponse & { message?: string };
            const parts = [d?.error, d?.err, d?.out, d?.message].filter(
              (x): x is string => typeof x === "string" && x.trim().length > 0
            );
            const msg = parts.length > 0 ? parts.join("\n") : res.statusText || "request failed";
            term.write(`\x1b[31m${msg}\x1b[0m\n`);
            writeFreshPrompt();
            return;
          }
        }
        if (data.needPassword === true && typeof data.loginUsername === "string") {
          pendingLoginUsername = data.loginUsername;
          maskSensitive = true;
          term.writeln("\x1b[90mPassword (masked):\x1b[0m");
          writeFreshPrompt();
          return;
        }
        if (data.out) term.write(data.out);
        if (data.err) term.write(`\x1b[31m${data.err}\x1b[0m`);
      } catch (err) {
        term.write(`\x1b[31mError: ${formatErr(err)}\x1b[0m`);
      }
      writeFreshPrompt();
    };

    const handleDataChunk = async (data: string): Promise<void> => {
      const tokens = feedInput(data, inputCarry);
      for (const tok of tokens) {
        if (tok.k === "up") {
          historyOlder();
          continue;
        }
        if (tok.k === "down") {
          historyNewer();
          continue;
        }
        if (tok.k === "left") {
          bumpEditing();
          if (cursorPos > 0) {
            cursorPos--;
            writePromptLine();
          } else {
            term.write("\x07");
          }
          continue;
        }
        if (tok.k === "right") {
          bumpEditing();
          if (cursorPos < this._lineBuf.length) {
            cursorPos++;
            writePromptLine();
          } else {
            term.write("\x07");
          }
          continue;
        }
        if (tok.k === "del") {
          bumpEditing();
          if (cursorPos < this._lineBuf.length) {
            const line = this._lineBuf;
            this._lineBuf = line.slice(0, cursorPos) + line.slice(cursorPos + 1);
            writePromptLine();
          } else {
            term.write("\x07");
          }
          continue;
        }
        const ch = tok.v;
        if (ch === "\r" || ch === "\n") {
          term.write("\r\n");
          await flushLine();
          continue;
        }
        if (ch === "\u007f" || ch === "\b") {
          bumpEditing();
          if (cursorPos > 0) {
            const line = this._lineBuf;
            this._lineBuf = line.slice(0, cursorPos - 1) + line.slice(cursorPos);
            cursorPos--;
            writePromptLine();
          }
          continue;
        }
        if (ch === "\t") {
          await runTabComplete();
          continue;
        }
        if (ch === "\x0f") {
          if (pendingLoginUsername === null) {
            maskSensitive = !maskSensitive;
          }
          writePromptLine();
          continue;
        }
        if (ch === "\x03") {
          this._lineBuf = "";
          cursorPos = 0;
          pendingLoginUsername = null;
          resetHistoryNav();
          histDraft = "";
          term.write("^C\r\n");
          writeFreshPrompt();
          continue;
        }
        const code = ch.charCodeAt(0);
        if (code < 32) continue;
        bumpEditing();
        const line = this._lineBuf;
        this._lineBuf = line.slice(0, cursorPos) + ch + line.slice(cursorPos);
        cursorPos++;
        writePromptLine();
      }
    };

    term.onData((data) => {
      this._chain = this._chain.then(() => handleDataChunk(data));
    });

    const remote = this._remoteApiPrefix();
    if (remote === null) {
      term.writeln("\x1b[1mWeb console\x1b[0m — commands run in this browser (Keeper SDK + CLI).");
      term.writeln("Tab completion and masked password entry are handled locally.");
      term.writeln("Optional: `keeper-host` attribute for vault region.");
    } else {
      term.writeln("\x1b[1mWeb console\x1b[0m — commands execute on your backend API.");
      term.writeln(
        "Transport: JSON POST { line, command } (same string) to " + `${this.apiBase}/cli`
      );
      term.writeln(
        "Tab completes commands (POST { line, command } to " + `${this.apiBase}/cli/complete).`
      );
    }
    term.writeln("Up / Down — history; Left / Right — move cursor; Delete — forward delete.");
    term.writeln(
      remote === null
        ? "Ctrl+O — toggle masked input (* per character; processed locally; masked lines are not saved to history)."
        : "Ctrl+O — toggle masked input (* per character; real text is sent to the API; masked lines are not saved to history)."
    );
    writeFreshPrompt();
    term.focus();
    const lateFocus = (): void => {
      try {
        fit.fit();
        if (term.cols < 2 || term.rows < 1) {
          term.resize(80, 24);
        }
        term.focus();
      } catch {
        /* ignore */
      }
    };
    setTimeout(lateFocus, 50);
    setTimeout(lateFocus, 300);

    this._ro = new ResizeObserver(() => {
      try {
        fit.fit();
        if (term.cols < 2 || term.rows < 1) {
          term.resize(80, 24);
        }
      } catch {
        /* detached */
      }
    });
    this._ro.observe(host);

    this._onWinResize = () => {
      try {
        fit.fit();
        if (term.cols < 2 || term.rows < 1) {
          term.resize(80, 24);
        }
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("resize", this._onWinResize);
  }

  private _teardownTerminal(): void {
    this._inputListeners?.abort();
    this._inputListeners = null;
    if (this._ro && this.shadowRoot) {
      const host = this.shadowRoot.querySelector(".wc-terminal-host");
      if (host) this._ro.unobserve(host);
      this._ro.disconnect();
    }
    this._ro = null;
    if (this._onWinResize) {
      window.removeEventListener("resize", this._onWinResize);
      this._onWinResize = null;
    }
    if (this._term) {
      this._term.dispose();
      this._term = null;
      this._fit = null;
    }
    this._started = false;
    this._chain = Promise.resolve();
  }
}

/**
 * Same behavior as {@link KeeperShell}; separate class because a custom element
 * constructor may only be registered once per registry (two tags ⇒ two classes).
 */
export class WebConsoleElement extends KeeperShell {}

if (!customElements.get(KEEPER_SHELL_TAG)) {
  customElements.define(KEEPER_SHELL_TAG, KeeperShell);
}
if (!customElements.get(WEB_CONSOLE_TAG)) {
  customElements.define(WEB_CONSOLE_TAG, WebConsoleElement);
}
