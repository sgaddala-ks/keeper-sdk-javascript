import * as path from 'path'
import {
    dispatchCliLine,
    KeeperSdkError,
    logger,
    ResultCodes,
    type CliResult,
    type KeeperVault,
} from '@keeper-security/keeper-sdk-javascript'
import {
    exampleShellCliHost,
    getExampleKeeperVault,
    resetExampleShellVault,
    setExampleKeeperHost,
} from './shellCliHost'

export type ShellCliRestoreOptions = {
    jsonPath: string
    host?: string
    /** Defaults to true. */
    sync?: boolean
}

function resolveJsonPathForCli(jsonPath: string): string {
    const expanded = jsonPath.trim().replace(/^~/, process.env.HOME || '')
    return path.isAbsolute(expanded) ? expanded : path.resolve(expanded)
}

export function buildRestoreSessionCliLine(jsonPath: string, sync: boolean): string {
    const abs = resolveJsonPathForCli(jsonPath)
    let line = `restore-session --from-json ${abs}`
    if (sync) line += ' --sync'
    return line
}

function throwOnCliFailure(label: string, result: CliResult): void {
    if (result.code === 0) return
    const detail = (result.err || result.out).trim()
    throw new KeeperSdkError(
        `${label} failed (exit ${result.code})${detail ? `: ${detail}` : ''}`,
        ResultCodes.INVALID_CREDENTIALS
    )
}

/** Authenticate via SDK `restore-session` CLI (same dispatch path as shellcomponent). */
export async function loginViaShellCliRestoreSession(
    options: ShellCliRestoreOptions
): Promise<KeeperVault> {
    const jsonPath = options.jsonPath
    const runSync = options.sync !== false

    resetExampleShellVault()
    setExampleKeeperHost(options.host)

    const line = buildRestoreSessionCliLine(jsonPath, runSync)
    logger.info(`[shell-cli] ${line}`)

    const result = await dispatchCliLine(line, exampleShellCliHost)
    throwOnCliFailure('restore-session', result)
    if (result.out.trim()) {
        logger.info(result.out.trimEnd())
    }

    const vault = getExampleKeeperVault()
    if (!vault.isLoggedIn) {
        throw new KeeperSdkError(
            'restore-session completed but vault is not logged in',
            ResultCodes.SESSION_TOKEN_EXPIRED
        )
    }
    return vault
}

/** Run `records list` through CLI dispatch (shell-style listing). */
export async function listRecordsViaShellCli(): Promise<string> {
    logger.info('[shell-cli] records list')
    const result = await dispatchCliLine('records list', exampleShellCliHost)
    throwOnCliFailure('records list', result)
    return result.out
}
