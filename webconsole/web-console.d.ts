/** Registered custom element: `<web-console api-base="/api">` */
export interface WebConsoleElement extends HTMLElement {
  /** Base URL for API (no trailing slash); POST `${apiBase}/cli`. Default `/api`. */
  apiBase: string;
  /** When true, terminal starts hidden behind “Open console”. Default false. */
  collapsed: boolean;
  /**
   * When true, each new prompt defaults to masked input (see `mask-input` attribute).
   * Use for secret entry; combine with `Ctrl+O` to toggle.
   */
  maskInput: boolean;
}

export declare class WebConsole extends HTMLElement implements WebConsoleElement {
  static readonly observedAttributes: string[];
  apiBase: string;
  collapsed: boolean;
  maskInput: boolean;
}

declare global {
  interface HTMLElementTagNameMap {
    "web-console": WebConsoleElement;
  }
}
