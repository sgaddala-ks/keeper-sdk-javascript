/**
 * Long-form `--help` text per CLI command (keeper-shell + KeeperSdk).
 */

const KEEPER_VAULT_SURFACE = `
KeeperVault (JavaScript SDK) — operations available in code (not all exposed as CLI yet):

  Session: login, loginWithSessionToken, logout, resumeSession, sync, disconnect, registerDevice
  Records: getRecords, findRecord, findRecords, getRecordByUid, getRecordsByType,
           addRecord, updateRecord, deleteRecord, moveRecord, getRecordHistory,
           printRecords
  Sharing: shareRecord, removeRecordShare, getRecordShareInfo
  Folders: listFolder, changeDirectory, getFolder, mkdir, addFolder, updateFolder,
           renameFolder, deleteFolder, rmdir, tree, getCurrentFolderUid
  Shared folders: getSharedFolders, listSharedFolders, shareFolder, …
  Teams / metadata: getTeams, getRecordMetadata, getSummary, …

Utilities exported from @keeper-security/keeper-sdk-javascript include searchRecords,
formatRecord, getRecordTitle, getRecordPassword, getRecordLogin, shareRecord, …
See the SDK package for full APIs.
`.trim();

const DOCS: Record<string, string> = {
  help: `
help — show commands or short syntax for one command

SYNOPSIS
  help [COMMAND]

DESCRIPTION
  Without arguments, lists every built-in command with a one-line summary.
  With COMMAND, prints the same overview line plus usage for that command.

  For full documentation on each command, run:
    COMMAND --help
    COMMAND -h

OPTIONS
  None. This command does not take GNU-style flags.

SEE ALSO
  Each command’s --help output.
`.trim(),

  login: `
login — authenticate to Keeper (vault session)

SYNOPSIS
  login [--username|--user EMAIL_OR_NAME]
  login [--username|--user U] [--session-token|--token|--st TOKEN]
  login [--username|--user U] [--session-token TOKEN] [--session-token-plain]

DESCRIPTION
  Establishes a Keeper session using KeeperVault inside keeper-shell (in-memory
  session storage in the browser).

  Username comes from --username / --user or KEEPER_USERNAME.

  Password MUST NOT appear on the CLI line (logging, proxies, browser history).
  Automation: set KEEPER_PASSWORD in the environment when embedding in Node.
  Web shell: run login with only a username; the UI prompts for a masked password
  and sends it through the login transport, not in "line".

  Session token login uses KeeperVault.loginWithSessionToken. The token may be
  passed on the command line or via KEEPER_SESSION_TOKEN (sensitive — same
  caveats as any secret on argv).

  --session-token-plain encodes the token from UTF-8 to base64url before the
  SDK call (same idea as the session_token_login example when the token is raw text).

  Device registration: session token login requires deviceToken + privateKey for
  this host in session storage. Use register-device (or a prior password login in
  this shell) to store them; see register-device --help.

OPTIONS
  --username, --user           Account identifier (often email).
  --session-token, --token, --st   Session token string (or use KEEPER_SESSION_TOKEN).
  --session-token-plain        Treat --session-token value as plain UTF-8 and encode base64url.

ENVIRONMENT
  KEEPER_USERNAME          Default username if not passed on the command line.
  KEEPER_PASSWORD          Password for non-interactive login (no session token).
  KEEPER_SESSION_TOKEN     Session token when not passed as a flag.
  KEEPER_HOST              Optional vault host / region (also: keeper-host attribute).

KEEPER SDK
  Uses KeeperVault.login or loginWithSessionToken, then sync. resumeSession and
  clone-code flows exist in the SDK but are not exposed in this CLI yet.

${KEEPER_VAULT_SURFACE}
`.trim(),

  logout: `
logout — end the current Keeper session

SYNOPSIS
  logout

DESCRIPTION
  Calls KeeperVault.logout when a session exists.

OPTIONS
  None.

${KEEPER_VAULT_SURFACE}
`.trim(),

  records: `
records — list vault records (record UID and title)

SYNOPSIS
  records [list]

DESCRIPTION
  Runs sync, then prints a table of record_uid and title for each record.

ARGUMENTS
  list    Optional; default behavior is to list. Other subcommands may be added later.

OPTIONS
  --help, -h    Show this help.

SESSION
  If not logged in, the CLI attempts env-based login (KEEPER_USERNAME /
  KEEPER_PASSWORD). Use the masked password flow in the shell if you rely on it.

KEEPER SDK
  Maps to KeeperVault.sync(), getRecords(), getRecordTitle().
  Related APIs you can extend in this CLI later: findRecords, getRecordsByType,
  addRecord, updateRecord, deleteRecord, shareRecord, getRecordHistory, …

${KEEPER_VAULT_SURFACE}
`.trim(),

  folders: `
folders — list shared folders

SYNOPSIS
  folders [list]

DESCRIPTION
  Runs sync, then prints shared_folder_uid and name for each shared folder.

ARGUMENTS
  list    Optional; default is list.

OPTIONS
  --help, -h    Show this help.

SESSION
  Same as records: uses env login if needed, or log in via the shell first.

KEEPER SDK
  Uses KeeperVault.sync(), getSharedFolders().
  Related: listSharedFolders, shareFolder, FolderManager / SharedFolderManager.

${KEEPER_VAULT_SURFACE}
`.trim(),

  mkdir: `
mkdir — host filesystem directory (disabled in embedded shell)

SYNOPSIS
  mkdir [-p|--parents] [--] RELATIVE_PATH

DESCRIPTION
  In keeper-shell with in-browser SDK transport, host mkdir is not available (no
  sandboxed filesystem). Set api-base to an HTTP CLI backend if you need
  this command, or use Keeper vault folder APIs in code.

OPTIONS
  -p, --parents    (remote server only.)
  --               End of options.

NOTE
  Vault folder operations live on KeeperVault (mkdir, addFolder, …) in the SDK.
`.trim(),

  "register-device": `
register-device — store device token and private key for session-token login

SYNOPSIS
  register-device --device-token|--dt B64 --private-key|--pk B64 [--username|--user U]

DESCRIPTION
  Calls KeeperVault.registerDevice to save device credentials for the current
  host in this shell’s in-memory session. After this, you can run:

    login --username YOU --session-token TOKEN

  without a prior password login in this shell, as long as the token is valid.

  Obtain device_token and private_key from another machine’s keeper config after
  a successful login, or from your integration that provisions device keys.
  Values accept base64 or base64url (same decoding as SessionManager / normal64Bytes).

OPTIONS
  --device-token, --dt     Device token string.
  --private-key, --pk      Device private key string.
  --username, --user       Optional; sets last username in session storage (recommended).

ENVIRONMENT
  REGISTER_DEVICE_TOKEN       Same as --device-token when flag omitted.
  REGISTER_DEVICE_PRIVATE_KEY Same as --private-key when flag omitted.
  KEEPER_HOST                 Same as other keeper commands.

KEEPER SDK
  KeeperVault.registerDevice(deviceToken, privateKey, { username? })

${KEEPER_VAULT_SURFACE}
`.trim(),
};

/** Long help text for `COMMAND --help`; null if unknown. */
export function getDetailedHelpPage(command: string): string | null {
  const key = command.toLowerCase();
  const body = DOCS[key];
  if (!body) return null;
  return `${body}\n`;
}

export function listDocumentedCommands(): readonly string[] {
  return Object.keys(DOCS).sort();
}
