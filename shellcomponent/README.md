# Keeper shell component (`@keeper-security/keeper-shell-component`)

Web component that embeds the Keeper CLI in the browser: **`<web-console>`** and **`<keeper-shell>`** (same behavior, two tag names). Commands run in-page via the Keeper JavaScript SDK and xterm.js.

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
| **`keeper-host`** | Optional Keeper vault / region host override (e.g. `keepersecurity.eu`). |
| **`mask-input`** | If present, new prompts start with masked input (`*`); **Ctrl+O** toggles masking in the shell. |

Boolean attributes follow HTML rules: include the attribute name to enable, omit to disable.

## CLI commands (in-browser)

The shell dispatches the Keeper SDK CLI (`dispatchCliLine`). Built-in commands include:

| Command | Purpose |
|---------|---------|
| `help` | List commands or show help for one |
| `login` / `logout` | Authenticate (password via masked prompt; never on the CLI line) |
| `register-device` | Store device token + key for session-token login |
| `restore-session` | Resume from extension session JSON (`--from-json`) |
| `sync` | Vault sync (`sync-down`, `d`) |
| `vault summary` | Record / folder / team counts |
| `get` | Record by UID or title (`--format`, `--unmask`) |
| `list` | Vault records (uid + title) |
| `ls`, `cd`, `tree`, `mkdir` | Folder navigation |
| `search` | Find records by title |
| `list-sf` | Shared folders (`--verbose` for counts) |
| `list-team` | Enterprise teams |
| `whoami` | Current account |
| `users` | Enterprise `list`, `view` |

Use `<command> --help` for full docs. Tab completes command names, subcommands, and flags.

Write/mutate operations (add/update/delete users or teams, share record, etc.) are available on `KeeperVault` in code; CLI coverage focuses on list/get/view flows usable from the shell.

## Programmatic API (optional)

The package also exports helpers used by the shell (CLI dispatch, completion, vault helpers). See **`keeper-shell.d.ts`** and **`src/index.ts`** for **`dispatchCliLine`**, **`completeCliLine`**, **`setShellCliContext`**, **`resetShellVault`**, **`loginWithCredentials`**, **`loginWithSessionToken`**, and the **`KeeperShell`** / **`WebConsoleElement`** classes.

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

Open the **`http://localhost:5175`** (or whatever port Vite prints) URL—**not** `file://`. The dev page is **`index.html`**; it loads **`src/dev-bootstrap.ts`**, which registers the shell.

The dev page runs the **Keeper SDK in the browser**. To avoid CORS locally, dev wires a **same-origin proxy** — see [`docs/SAME_ORIGIN_DEV.md`](docs/SAME_ORIGIN_DEV.md). Only `npm run dev` is needed.

```text
restore-session --from-json /dev/keeper-session.json --sync
list
```

Set region on the element when needed: `<web-console keeper-host="keepersecurity.eu">`.

```bash
npm run build
```

Runs **`build:deps`** (keeperapi + KeeperSdk) then Vite. Produces **`dist/keeper-shell.es.js`** and **`dist/keeper-shell.umd.cjs`** (~6–8 MB; Keeper SDK is bundled in-browser).

## Production deployment (e.g. Keeper Web Vault / webpack)

1. **Build and publish** — ship only `dist/`, `keeper-shell.d.ts`, and `package.json` `exports` (see `files` field).
2. **Import once** in your app entry: `import "@keeper-security/keeper-shell-component";`
3. **Render** `<web-console>` or `<keeper-shell>` (JSX: use the string tag name `"web-console"`).
4. **Region** — set `keeper-host` when not on US prod (e.g. `keepersecurity.eu`).
5. **Networking** — the SDK calls Keeper REST/WSS from the browser. Your origin must allow it (CORS) or proxy Keeper through your app origin (same pattern as [`docs/SAME_ORIGIN_DEV.md`](docs/SAME_ORIGIN_DEV.md), implemented in your gateway/nginx, not Vite).
6. **`restore-session --from-json`** — in production use inline JSON or an `https://` URL on your origin; local file paths work only in Vite dev (`/@fs`, `/dev/keeper-session.json`).

The bundle is self-contained (no separate CLI server). Do not expect `remote` / `api-base` attributes — those were removed.

## Security and networking

Keeper API calls run from the user’s browser. Your page’s origin, CSP, and CORS (or a reverse proxy on your origin) must allow what the SDK needs. See [`docs/SAME_ORIGIN_DEV.md`](docs/SAME_ORIGIN_DEV.md) for the local dev proxy pattern.

## License

See **`package.json`** (`license` field).
