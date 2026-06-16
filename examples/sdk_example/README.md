# Keeper SDK Examples

Interactive examples demonstrating the Keeper JavaScript SDK and the built-in shell CLI.

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

## Built-in shell CLI

These commands are registered in `KeeperSdk/src/cli` and run via `dispatchCliLine` (see `records:list:shell-cli`).

**Before login**

| Command | Description |
|---------|-------------|
| `help` | List commands or show docs (`help get`, `get --help`) |
| `login` | Password or session-token login |
| `restore-session` | Restore from extension `SessionParams` JSON or flags |

**After login**

| Command | Aliases | Description |
|---------|---------|-------------|
| `logout` | - | End session |
| `sync` | `syncdown`, `sync-down`, `d` | Sync vault from Keeper |
| `whoami` | - | Current user and vault counts |
| `list` | `l` | All records (table) |
| `search` | `s` | Search records by text |
| `get` | `g` | Record or folder details |
| `ls` | - | List folder contents |
| `cd` | - | Change current folder |
| `tree` | - | Folder tree |
| `mkdir` | - | Create folder (`-sf` for shared folder) |
| `list-sf` | `lsf` | List shared folders |
| `vault summary` | - | Vault counts |

Write operations (add/update/delete records, share, rename folder, -) are **SDK API only** - use the npm scripts below, not shell commands.

### Finding records and folders

| Goal | Shell command |
|------|----------------|
| Record by UID | `get <record-uid>` |
| Record by title / text | `search gmail` or `get "Gmail Login"` |
| Shared folder | `get <sf-uid>` or `list-sf <pattern>` |
| Folder navigation | `ls`, `cd`, `tree`, `mkdir` |

Use **`get`** for exact UID lookup. Use **`search`** for text in titles and fields (not teams or users).

```bash
# Restore session then list records (dispatchCliLine path)
npm run records:list:shell-cli -- --from-json /path/to/session.json [--host keepersecurity.eu]

# Restore-session via SDK example script
npm run auth:restore-session
```

## SDK programmatic examples

These scripts call `KeeperVault` directly. They are not shell commands.

### Authentication

| Command | Description |
|---------|-------------|
| `npm run auth:login` | Master password login with retry, masked input, and vault sync |
| `npm run auth:session-token` | Session-token login; requires device keys in `~/.keeper/config.json` |
| `npm run auth:register-device` | Store device token + private key on vault (API helper for session-token login) |
| `npm run auth:restore-session` | Restore session via `restore-session` CLI dispatch |

### Records

| Command | Description |
|---------|-------------|
| `npm run records:list` | List all records |
| `npm run records:list:shell-cli` | List via shell CLI dispatch |
| `npm run records:get` | Get record by UID or title |
| `npm run records:add` | Add a typed record |
| `npm run records:update` | Update record fields |
| `npm run records:delete` | Delete a record |
| `npm run records:history` | Record revision history |
| `npm run records:find-password` | Find password and copy to clipboard |
| `npm run records:move` | Move record to another folder |

### Folders

| Command | Description |
|---------|-------------|
| `npm run folders:ls` | List folder contents |
| `npm run folders:cd` | Change directory |
| `npm run folders:get` | Get folder details |
| `npm run folders:mkdir` | Create folder |
| `npm run folders:updatedir` | Rename or update folder |
| `npm run folders:removedir` | Remove folder |
| `npm run folders:tree` | Folder tree |

### Shared folders & sharing

| Command | Description |
|---------|-------------|
| `npm run shared-folders:list-sf` | List shared folders |
| `npm run shared-folders:share-folder` | Share a folder |
| `npm run sharing:share-record` | Share a record |

### Enterprise (SDK API only)

Teams, users, and roles scripts (`teams:*`, `users:*`, `roles:*`) use the SDK enterprise APIs. They are not registered as shell commands in this release.

## Usage

```bash
npm run auth:login
npm run records:list
npm run folders:ls
```

Most examples log in via persistent login or prompt for credentials.

**Restore-session on `records:list`:**

```bash
npm run records:list -- --restore-session --from-json /path/to/session.json --host keepersecurity.eu --no-sync
```

If Node shell CLI works but the browser shell fails, suspect host I/O (`readTextFile` / Vite `/@fs`), CORS, or region - not `KeeperVault.restoreSession` itself.
