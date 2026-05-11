import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import xtermCss from "@xterm/xterm/css/xterm.css?inline";

const ATTR_API_BASE = "api-base";
const ATTR_COLLAPSED = "collapsed";
const ATTR_HEIGHT = "height";
/** When set, each new `$ ` prompt starts with masked input (`*` display). Toggle with Ctrl+O. */
const ATTR_MASK_INPUT = "mask-input";

function normalizeApiBase(raw: string | null): string {
  const s = (raw || "/api").trim();
  return s.replace(/\/$/, "") || "/api";
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

/**
 * Turn raw terminal input into characters + arrow events. `carry` holds an
 * incomplete escape sequence across onData chunks.
 */
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

export class WebConsole extends HTMLElement {
  static observedAttributes = [ATTR_API_BASE, ATTR_COLLAPSED, ATTR_HEIGHT, ATTR_MASK_INPUT];

  private _term: Terminal | null = null;
  private _fit: FitAddon | null = null;
  private _ro: ResizeObserver | null = null;
  private _onWinResize: (() => void) | null = null;
  private _chain: Promise<void> = Promise.resolve();
  private _lineBuf = "";
  private _started = false;
  private _completing = false;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  get apiBase(): string {
    return normalizeApiBase(this.getAttribute(ATTR_API_BASE));
  }

  set apiBase(v: string) {
    this.setAttribute(ATTR_API_BASE, v || "/api");
  }

  get collapsed(): boolean {
    return this.hasAttribute(ATTR_COLLAPSED);
  }

  set collapsed(v: boolean) {
    if (v) this.setAttribute(ATTR_COLLAPSED, "");
    else this.removeAttribute(ATTR_COLLAPSED);
  }

  /** When true, new prompts default to masked input until toggled (see `mask-input` attribute). */
  get maskInput(): boolean {
    return this.hasAttribute(ATTR_MASK_INPUT);
  }

  set maskInput(v: boolean) {
    if (v) this.setAttribute(ATTR_MASK_INPUT, "");
    else this.removeAttribute(ATTR_MASK_INPUT);
  }

  attributeChangedCallback(name: string, _old: string | null, val: string | null): void {
    if (name === ATTR_HEIGHT && this.shadowRoot) {
      const host = this.shadowRoot.querySelector(".wc-terminal-host");
      if (host instanceof HTMLElement) host.style.height = val || "320px";
    }
  }

  connectedCallback(): void {
    if (!this.shadowRoot) return;
    this._renderShell();
    if (!this.collapsed) {
      this._mountTerminal();
    }
    this.shadowRoot.querySelector(".wc-toggle")?.addEventListener("click", () => this._toggle());
  }

  disconnectedCallback(): void {
    this._teardownTerminal();
  }

  private _toggle(): void {
    const panel = this.shadowRoot?.querySelector(".wc-panel");
    const btn = this.shadowRoot?.querySelector(".wc-toggle");
    if (!(panel instanceof HTMLElement) || !(btn instanceof HTMLButtonElement)) return;
    const hidden = panel.hasAttribute("hidden");
    if (hidden) {
      panel.removeAttribute("hidden");
      btn.textContent = "Hide console";
      this._mountTerminal();
    } else {
      panel.setAttribute("hidden", "");
      btn.textContent = "Open console";
      this._teardownTerminal();
    }
  }

  private _renderShell(): void {
    const height = this.getAttribute(ATTR_HEIGHT) || "320px";
    if (!this.shadowRoot) return;
    this.shadowRoot.innerHTML = "";

    const style = document.createElement("style");
    style.textContent = `
      ${xtermCss}
      :host { display: block; font-family: system-ui, sans-serif; }
      .wc-root { padding: 12px; }
      .wc-toggle {
        font-size: 16px;
        padding: 8px 12px;
        cursor: pointer;
        border-radius: 8px;
        border: 1px solid #ccc;
        background: #f5f5f5;
      }
      .wc-panel {
        margin-top: 12px;
        border: 1px solid #ccc;
        border-radius: 10px;
        overflow: hidden;
        background: #0b0b0b;
      }
      .wc-panel[hidden] { display: none; }
      .wc-terminal-host {
        height: ${height};
        width: 100%;
        box-sizing: border-box;
        padding: 4px 0;
      }
      .wc-terminal-host .xterm { height: 100%; }
      .wc-terminal-host .xterm-viewport { background: transparent !important; }
    `;

    const root = document.createElement("div");
    root.className = "wc-root";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "wc-toggle";
    toggle.textContent = this.collapsed ? "Open console" : "Hide console";

    const panel = document.createElement("div");
    panel.className = "wc-panel";
    if (this.collapsed) panel.setAttribute("hidden", "");

    const host = document.createElement("div");
    host.className = "wc-terminal-host";

    panel.appendChild(host);
    root.appendChild(toggle);
    root.appendChild(panel);
    this.shadowRoot.append(style, root);
  }

  private _mountTerminal(): void {
    if (this._started) return;
    const host = this.shadowRoot?.querySelector(".wc-terminal-host");
    if (!(host instanceof HTMLElement)) return;

    const term = new Terminal({
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
    fit.fit();

    this._term = term;
    this._fit = fit;
    this._started = true;
    this._lineBuf = "";

    const HISTORY_MAX = 500;
    const history: string[] = [];
    const inputCarry = { s: "" };
    let histFromEnd = -1;
    let histDraft = "";
    /** Cursor position within `_lineBuf` (0 … length); insertion point before `cursorPos`. */
    let cursorPos = 0;
    /** When true, draw `*` for each character but keep real text in `_lineBuf` (secrets). Toggle: Ctrl+O. */
    let maskSensitive = this.hasAttribute(ATTR_MASK_INPUT);
    /** After `login --username …` returned `needPassword`, next line is password (always masked). */
    let pendingLoginUsername: string | null = null;

    const maskDisplayActive = (): boolean =>
      maskSensitive || pendingLoginUsername !== null;

    /** After POST `/cli/login`, drop forced password masking so normal typing is visible again. */
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
        const url = `${this.apiBase}/cli/complete`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ line: this._lineBuf }),
        });
        let data: CompleteResponse;
        try {
          data = (await res.json()) as CompleteResponse;
        } catch {
          term.write("\x07");
          return;
        }
        if (!res.ok) {
          term.write("\x07");
          return;
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
        term.writeln(`\x1b[90m${candidates.join("  ")}\x1b[0m`);
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
        const urlLogin = `${this.apiBase}/cli/login`;
        term.writeln("\x1b[90mSigning in…\x1b[0m");
        try {
          const res = await fetch(urlLogin, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password: cmd }),
          });
          let data: CliResponse;
          try {
            data = (await res.json()) as CliResponse;
          } catch {
            term.write(`\x1b[31mHTTP ${res.status}: invalid response\x1b[0m\n`);
            resetMaskAfterPasswordFlow();
            writeFreshPrompt();
            return;
          }
          if (!res.ok) {
            const msg = data?.error ?? res.statusText ?? "request failed";
            term.write(`\x1b[31m${msg}\x1b[0m\n`);
            resetMaskAfterPasswordFlow();
            writeFreshPrompt();
            return;
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

      const url = `${this.apiBase}/cli`;
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ line: cmd }),
        });
        let data: CliResponse;
        try {
          data = (await res.json()) as CliResponse;
        } catch {
          term.write(`\x1b[31mHTTP ${res.status}: invalid response\x1b[0m\n`);
          writeFreshPrompt();
          return;
        }
        if (!res.ok) {
          const msg = data?.error ?? res.statusText ?? "request failed";
          term.write(`\x1b[31m${msg}\x1b[0m\n`);
          writeFreshPrompt();
          return;
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

    term.writeln("\x1b[1mWeb console\x1b[0m — commands execute on your backend API.");
    term.writeln("Transport: JSON POST { line } to " + `${this.apiBase}/cli`);
    term.writeln("Tab completes commands (POST { line } to " + `${this.apiBase}/cli/complete).`);
    term.writeln("Up / Down — history; Left / Right — move cursor; Delete — forward delete.");
    term.writeln(
      "Ctrl+O — toggle masked input (* per character; real text is sent to the API; masked lines are not saved to history)."
    );
    writeFreshPrompt();
    term.focus();

    this._ro = new ResizeObserver(() => {
      try {
        fit.fit();
      } catch {
        /* detached */
      }
    });
    this._ro.observe(host);

    this._onWinResize = () => {
      try {
        fit.fit();
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("resize", this._onWinResize);
  }

  private _teardownTerminal(): void {
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
