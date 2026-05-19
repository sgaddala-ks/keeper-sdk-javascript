import type { DRecord, DSharedFolder } from '@keeper-security/keeperapi'

export type CliResult = {
    code: number
    out: string
    err: string
    /** Login needs masked password from host UI (never in CLI line). */
    needPassword?: boolean
    loginUsername?: string
}

export type ParsedCli = {
    positional: string[]
    opts: Map<string, string | true>
}

/** Vault surface used by CLI command handlers. */
export type KeeperCliVault = {
    readonly isLoggedIn: boolean
    login(username: string, password: string): Promise<void>
    loginWithSessionToken(username: string, sessionToken: string): Promise<void>
    logout(): Promise<void>
    sync(): Promise<void>
    getRecords(): DRecord[]
    getSharedFolders(): DSharedFolder[]
    registerDevice(deviceToken: string, privateKey: string, options?: { username?: string }): Promise<void>
}

/** Host adapter (browser shell, Node Commander, tests). */
export type KeeperCliHost = {
    getVault(): KeeperCliVault
    envString(name: string): string | undefined
    formatError(context: string, err: unknown): string
}

export type CliHelpDoc = {
    title: string
    synopsis?: string
    description?: string
    arguments?: string
    options?: string
    environment?: string
    keeperSdk?: string
    seeAlso?: string
    note?: string
    /** Append standard KeeperVault API overview (login, records, folders, …). */
    appendVaultSurface?: boolean
}

export type CliCommandDefinition = {
    name: string
    order?: number
    description: string
    usage: string
    aliases?: readonly string[]
    subcommands?: readonly string[]
    flagOptions?: readonly string[]
    /** If set, unknown options are rejected (excluding help). */
    allowedOptions?: ReadonlySet<string>
    help: CliHelpDoc
    run: (host: KeeperCliHost, parsed: ParsedCli) => Promise<CliResult>
}
