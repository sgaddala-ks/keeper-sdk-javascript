/**
 * Dev page entry only. Dynamic-imports the shell so load failures surface in the page
 * (static `import "./KeeperShell.js"` would fail the whole module with no UI feedback).
 */
import "./bufferPolyfill.js";

function showShellLoadError(err: unknown): void {
  const msg = err instanceof Error ? `${err.message}\n\n${err.stack ?? ""}` : String(err);
  const hint =
    "Fix:\n" +
    "  1. cd shellcomponent && npm install && npm run dev\n" +
    "  2. Open the http://localhost URL Vite prints (do not use file://).\n" +
    "  3. With file:../KeeperSdk, the dev server uses ../KeeperSdk/src (ESM); run build:local-keeper-sdk only if you need dist/ for other tools.\n";
  document.querySelectorAll("web-console, keeper-shell").forEach((node) => {
    const el = node as HTMLElement;
    while (el.firstChild) el.removeChild(el.firstChild);
    const pre = document.createElement("pre");
    pre.style.cssText =
      "display:block;margin:0;padding:16px;background:#2a0a0a;color:#fecaca;border:2px solid #991b1b;border-radius:8px;white-space:pre-wrap;font:13px/1.45 ui-monospace,monospace;";
    pre.textContent = `Keeper shell failed to load:\n\n${msg}\n\n${hint}`;
    el.appendChild(pre);
    el.style.display = "block";
    el.style.width = "100%";
    el.style.minHeight = "16rem";
    el.style.boxSizing = "border-box";
  });
}

void (async () => {
  try {
    const { installKeeperDevFetchLogger } = await import("./devApiLogger.js");
    installKeeperDevFetchLogger();
  } catch (e) {
    console.warn("[keeper-shell dev] fetch logger skipped (non-fatal)", e);
  }
  try {
    await import("./KeeperShell.js");
  } catch (err: unknown) {
    showShellLoadError(err);
    console.error("[keeper-shell] failed to load", err);
  }
})();
