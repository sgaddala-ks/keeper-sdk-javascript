# Keeper shell component (`@keeper-security/keeper-shell-component`)

Web component that embeds the Keeper CLI in the browser: **`<web-console>`** and **`<keeper-shell>`** (same behavior, two tag names). The default mode runs the in-browser Keeper JavaScript SDK and xterm.js; you can optionally point CLI traffic at your own HTTP relay.

## Requirements

- A modern browser with **custom elements** and **shadow DOM**.
- Serve the app over **HTTP(S)**. ES modules and the SDK do not run from `file://`.

## Install

```bash
npm install @keeper-security/keeper-shell-component
```

In this monorepo you can depend on the package with a **file** URL, for example `"file:../shellcomponent"`. Run **`npm run build`** in `shellcomponent` first so **`dist/`** exists for consumers that resolve the published **`exports`** entry.

## Register the custom elements

Import the package **once** before relying on `<web-console>` or `<keeper-shell>` in the DOM. The entry module applies the **`buffer`** shim and registers both tags.

```ts
import "@keeper-security/keeper-shell-component";
```

TypeScript types are exposed via **`keeper-shell.d.ts`** (see **`package.json` → `exports`**).

## Use in HTML

```html
<script type="module">
  import "@keeper-security/keeper-shell-component";
</script>

<web-console height="360px"></web-console>
```

Equivalent tag:

```html
<keeper-shell height="360px"></keeper-shell>
```

## Use in a bundled app (Vite, webpack, etc.)

```ts
// e.g. main.ts or app entry
import "@keeper-security/keeper-shell-component";
```

Then render the tag from your framework or template. Example with JSX (tag name must be a string so the browser upgrades it to the custom element):

```tsx
export function Page() {
  return (
    <web-console
      height="360px"
      collapsed
    />
  );
}
```

If TypeScript complains about unknown intrinsic elements, extend **`JSX.IntrinsicElements`** for **`"web-console"`** / **`"keeper-shell"`**, or create the element with **`document.createElement("web-console")`** and attach it in a ref.

## Attributes

| Attribute | Description |
|-----------|-------------|
| **`height`** | Height of the terminal region (e.g. `360px`, `24rem`). Default **`320px`**. |
| **`collapsed`** | If present, the terminal panel starts hidden; only the shell toggle control is shown until the user opens it. |
| **`embed`** | If present, renders a full in-page terminal **without** the open/hide control. |
| **`remote`** | If present, the CLI uses HTTP (`POST` to **`${apiBase}/cli`**, etc.) instead of the in-browser SDK. |
| **`api-base`** | Base URL for the remote CLI (no trailing slash). Default **`/api`** when **`remote`** is set. |
| **`keeper-host`** | Optional Keeper vault / region host override when using the in-browser SDK. |
| **`mask-input`** | If present, new prompts start with masked input (`*`); **Ctrl+O** toggles masking in the shell. |

Boolean attributes follow HTML rules: include the attribute name to enable, omit to disable.

## Programmatic API (optional)

The package also exports helpers used by the shell (CLI dispatch, completion, vault helpers). See **`keeper-shell.d.ts`** and **`src/index.ts`** for **`dispatchCliLine`**, **`completeCliLine`**, **`setShellCliContext`**, **`resetShellVault`**, **`loginWithCredentials`**, and the **`KeeperShell`** / **`WebConsoleElement`** classes.

## Layout note (non-embed)

When the open/hide chrome is shown (**not** **`embed`**), the toggle is **`position: fixed`** at the **bottom-left** of the viewport (`12px` from edges). When the panel is visible, extra bottom padding is reserved so the terminal is not covered. Avoid placing critical fixed UI in that corner.

## UMD bundle

**`dist/keeper-shell.umd.cjs`** is built for environments that expect a UMD script. Wire it according to your host page’s script loader; the ESM path **`dist/keeper-shell.es.js`** is the primary **`import`** target.

## Local development

From **`shellcomponent/`**:

```bash
npm install
npm run dev
```

Open the **`http://localhost:5175`** (or whatever port Vite prints) URL—**not** `file://`. The dev page is **`index.html`**; it loads **`src/dev-bootstrap.ts`**, which registers the shell and optional dev-only fetch logging.

```bash
npm run build
```

Produces **`dist/keeper-shell.es.js`**, **`dist/keeper-shell.umd.cjs`**, and emitted assets (for example the console toggle image if present).

## Security and networking

- **In-browser SDK** mode performs Keeper API calls from the user’s browser; your page’s origin, CSP, and CORS must allow what the SDK needs.
- **`remote`** mode sends CLI lines to **`api-base`**; only point it at backends you trust and that enforce auth appropriately.

## License

See **`package.json`** (`license` field).
