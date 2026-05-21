import * as path from 'path'
import { KeeperSdkError, ResultCodes, type KeeperVault } from '@keeper-security/keeper-sdk-javascript'
import { loginViaShellCliRestoreSession } from './shellCliRestore'

export type RestoreSessionLoginOptions = {
    /** Path to extension-style session JSON (required). */
    jsonPath: string
    host?: string
    /** Run syncDown after restore (default true). */
    sync?: boolean
}

export function requireSessionJsonPath(jsonPath: string | undefined, context: string): string {
    const trimmed = jsonPath?.trim()
    if (!trimmed) {
        throw new KeeperSdkError(
            `${context}: session JSON path is required (no default). ` +
                'Pass --from-json /path/to/session.json or set RESTORE_SESSION_JSON.',
            ResultCodes.INVALID_CREDENTIALS
        )
    }
    return path.resolve(trimmed.replace(/^~/, process.env.HOME || ''))
}

/**
 * Restore session via SDK CLI dispatch (same path as shellcomponent `restore-session`).
 */
export async function loginViaRestoreSession(options: RestoreSessionLoginOptions): Promise<KeeperVault> {
    const jsonPath = requireSessionJsonPath(options.jsonPath, 'restore-session')
    return loginViaShellCliRestoreSession({
        jsonPath,
        host: options.host,
        sync: options.sync,
    })
}

export type RestoreCliArgs = {
    restoreSession: boolean
    jsonPath?: string
    host?: string
    noSync: boolean
}

/** Parse `--restore-session`, `--from-json`, `--host`, `--no-sync` from process.argv. */
export function parseRestoreCliArgs(argv: string[] = process.argv): RestoreCliArgs {
    let restoreSession = false
    let jsonPath: string | undefined
    let host: string | undefined
    let noSync = false

    for (let i = 2; i < argv.length; i++) {
        const arg = argv[i]
        if (arg === '--restore-session') {
            restoreSession = true
        } else if (arg === '--from-json' && argv[i + 1]) {
            restoreSession = true
            jsonPath = argv[++i]
        } else if (arg === '--host' && argv[i + 1]) {
            host = argv[++i]
        } else if (arg === '--no-sync') {
            noSync = true
        }
    }

    return { restoreSession, jsonPath, host, noSync }
}

/** Validate CLI restore flags before loginViaRestoreSession. */
export function assertRestoreCliArgs(cli: RestoreCliArgs): asserts cli is RestoreCliArgs & { jsonPath: string } {
    if (!cli.restoreSession) return
    requireSessionJsonPath(cli.jsonPath, 'records')
}
