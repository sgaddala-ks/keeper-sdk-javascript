import type { DRecord, DSharedFolder, SyncResult } from '@keeper-security/keeperapi'
import type { SessionRestoreInput } from '../auth/sessionRestore'
import type { ChangeDirectoryResult } from '../folders/changeDirectory'
import type { FolderTreeBuildOptions } from '../folders/folderTree'
import type { GetFolderOptions, GetFolderResult } from '../folders/getFolder'
import type { ListFolderOptions, ListFolderResult } from '../folders/listFolder'
import type { MkdirOptions } from '../folders/addFolder'

export type CliResult = {
    code: number
    out: string
    err: string
    /** Set when the host UI must prompt for a masked password (never on the CLI line). */
    needPassword?: boolean
    loginUsername?: string
}

export type ParsedCli = {
    positional: string[]
    opts: Map<string, string | true>
}

/** Vault surface used by CLI command handlers. Folder methods are optional — commands check at runtime. */
export type KeeperCliVault = {
    readonly isLoggedIn: boolean
    login(username: string, password: string): Promise<void>
    loginWithSessionToken(username: string, sessionToken: string): Promise<void>
    logout(): Promise<void>
    sync(): Promise<SyncResult>
    getRecords(): DRecord[]
    getSharedFolders(): DSharedFolder[]
    registerDevice(deviceToken: string, privateKey: string, options?: { username?: string }): Promise<void>
    restoreSession(input: SessionRestoreInput): Promise<void>
    listFolder?: (options?: ListFolderOptions) => Promise<ListFolderResult>
    tree?: (options?: FolderTreeBuildOptions) => Promise<string>
    changeDirectory?: (path: string) => Promise<ChangeDirectoryResult>
    getCurrentFolderUid?: () => string | null
    getWorkingFolderDisplayName?: () => string
    getFolder?: (uidOrName: string, options?: GetFolderOptions) => Promise<GetFolderResult>
    mkdir?: (path: string, options?: MkdirOptions) => Promise<{ folderUid: string; success: boolean; message?: string }>
}

/** Host adapter (browser shell, Node script, tests). `readTextFile` is optional. */
export type KeeperCliHost = {
    getVault(): KeeperCliVault
    envString(name: string): string | undefined
    formatError(context: string, err: unknown): string
    readTextFile?: (path: string) => Promise<string>
}

export type CliHelpDoc = {
    title: string
    synopsis?: string
    description?: string
    arguments?: string
    options?: string
    environment?: string
    examples?: string
    seeAlso?: string
    note?: string
}

export type CliCommandDefinition = {
    name: string
    order?: number
    description: string
    usage: string
    aliases?: readonly string[]
    subcommands?: readonly string[]
    flagOptions?: readonly string[]
    /** When set, options outside this set are rejected (`--help` / `-h` always allowed). */
    allowedOptions?: ReadonlySet<string>
    help: CliHelpDoc
    run: (host: KeeperCliHost, parsed: ParsedCli) => Promise<CliResult>
}
