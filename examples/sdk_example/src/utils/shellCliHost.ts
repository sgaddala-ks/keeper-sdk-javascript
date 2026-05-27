import * as fs from 'fs/promises'
import type { KeeperCliHost, KeeperCliVault } from '@keeper-security/keeper-sdk-javascript'
import {
    KeeperVault,
    LogLevel,
    SessionManager,
    SdkDefaults,
} from '@keeper-security/keeper-sdk-javascript'
import { InMemoryConfigLoader } from './inMemoryConfigLoader'

type VaultInstance = KeeperVault

let keeperHost: string | undefined
let vault: VaultInstance | null = null

/** Override region/host (mirrors shell's `keeper-host` / `KEEPER_HOST`). */
export function setExampleKeeperHost(host: string | undefined): void {
    const trimmed = host?.trim()
    keeperHost = trimmed || undefined
    vault = null
}

export function getExampleKeeperHost(): string | undefined {
    if (keeperHost) return keeperHost
    const fromEnv = (process.env.KEEPER_HOST || '').trim()
    return fromEnv || undefined
}

export function resetExampleShellVault(): void {
    vault = null
}

function getVault(): VaultInstance {
    if (!vault) {
        const host = getExampleKeeperHost()
        vault = new KeeperVault({
            ...(host ? { host } : {}),
            useConsoleAuth: false,
            logLevel: LogLevel.WARN,
            clientVersion: SdkDefaults.CLIENT_VERSION,
            sessionStorage: new SessionManager(new InMemoryConfigLoader()),
        })
    }
    return vault
}

/** Underlying vault (e.g. for `cleanup()` after CLI dispatch). */
export function getExampleKeeperVault(): VaultInstance {
    return getVault()
}

function errMsg(e: unknown): string {
    return e instanceof Error ? e.message : String(e)
}

function formatKeeperClientError(context: string, e: unknown): string {
    return `${context}: ${errMsg(e)}\n`
}

function asCliVault(v: VaultInstance): KeeperCliVault {
    return {
        get isLoggedIn() {
            return v.isLoggedIn
        },
        login: (u, p) => v.login(u, p),
        loginWithSessionToken: (u, t) => v.loginWithSessionToken(u, t),
        logout: () => v.logout(),
        sync: () => v.sync(),
        getRecords: () => v.getRecords(),
        getSharedFolders: () => v.getSharedFolders(),
        registerDevice: (dt, pk, o) => v.registerDevice(dt, pk, o),
        restoreSession: (input) => v.restoreSession(input),
        listFolder: (options) => v.listFolder(options),
        tree: (options) => v.tree(options),
        changeDirectory: (path) => v.changeDirectory(path),
        getCurrentFolderUid: () => v.getCurrentFolderUid(),
        getWorkingFolderDisplayName: () => v.getWorkingFolderDisplayName(),
        getFolder: (uidOrName, options) => v.getFolder(uidOrName, options),
        mkdir: (path, options) => v.mkdir(path, options),
    }
}

async function readTextFile(filePath: string): Promise<string> {
    const p = filePath.trim().replace(/^@/, '')
    if (/^https?:\/\//i.test(p)) {
        const res = await fetch(p)
        if (!res.ok) {
            throw new Error(`HTTP ${res.status} loading ${p}`)
        }
        return res.text()
    }
    const resolved = p.replace(/^~/, process.env.HOME || '')
    return fs.readFile(resolved, 'utf8')
}

function envString(name: string): string | undefined {
    const v = process.env[name]
    return typeof v === 'string' && v.length > 0 ? v : undefined
}

/** Node `KeeperCliHost` (fs file-reads, no browser proxy). */
export const exampleShellCliHost: KeeperCliHost = {
    getVault: () => asCliVault(getVault()),
    envString,
    formatError: formatKeeperClientError,
    readTextFile,
}
