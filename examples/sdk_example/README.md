# Keeper SDK Examples

Interactive examples demonstrating the Keeper JavaScript SDK.

## Prerequisites

- Node.js 20 LTS or newer (aligned with `@types/node` in this repo)
- A Keeper account with credentials

## Setup

```bash
# From the repository root
cd examples/sdk_example

# Install dependencies
npm install

# Link the local SDK (if developing against the local KeeperSdk)
npm run link-local
```

## Configuration

Examples use `~/.keeper/config.json` for saved credentials and persistent login. If the file is not found, you will be prompted for server, username, and password.

For restore-session flows, provide a path to session JSON (extension `SessionParams` shape). There is no default path.

 ## Available Examples

### Authentication

| Command | Description |
|---|---|
| `npm run auth:login` | Master password login with retry logic, masked input, and vault sync. Automatically attempts persistent login (via clone code from `~/.keeper/config.json`) before falling back to the password prompt. |
| `npm run auth:session-token` | Login using an existing session token for pre-authenticated workflows. Prompts for username, host, and session token. Requires device token + private key in `~/.keeper/config.json` or use `auth:register-device` first in the same run. |
| `npm run auth:register-device` | Store device token + device private key on a `KeeperVault` (in-memory), optionally then `loginWithSessionToken` + sync. |
| `npm run auth:restore-session` | Restore via SDK `restore-session` CLI dispatch (same path as shellcomponent). Prompts for session JSON path. |

### Records

| Command | Description |
|---|---|
| `npm run records:list` | List all records in the vault (password / persistent login via `login()`) |
| `npm run records:get` | Get details of a specific record by UID or title |
| `npm run records:add` | Add a new typed record to the vault |
| `npm run records:update` | Update fields on an existing record |
| `npm run records:delete` | Delete a record (with confirmation prompt) |
| `npm run records:history` | View revision history for a record |
| `npm run records:find-password` | Find a record's password and copy it to clipboard |
| `npm run records:move` | Move a record to a different folder |

### Sharing

| Command | Description |
|---|---|
| `npm run sharing:share-record` | Share a record with another Keeper user |

## Usage

Run any example with `npm run <script>`:

```bash
npm run auth:login
npm run records:list
npm run records:get
```

Most examples will log in automatically using persistent login (if configured) or prompt for credentials. After authentication, follow the interactive prompts.

**Restore-session flag** on `records:list` (requires `--from-json`; no default path). Uses the same SDK CLI dispatch as shellcomponent (`dispatchCliLine` → `restore-session`):

```bash
npm run records:list -- --restore-session --from-json /path/to/session.json
npm run records:list -- --restore-session --from-json /path/to/session.json --host keepersecurity.eu
npm run records:list -- --restore-session --from-json /path/to/session.json --no-sync
```

**Shell-parity debug** — restore and list only through CLI commands (closest match to typing in keeper-shell):

```bash
npm run records:list:shell-cli -- --from-json /path/to/session.json
npm run records:list:shell-cli -- --from-json /path/to/session.json --host keepersecurity.eu
```

If Node succeeds but the browser shell fails, the difference is likely host I/O (`readTextFile` / Vite `/@fs`), CORS, or region (`keeper-host` / `KEEPER_HOST`), not `KeeperVault.restoreSession` itself.
