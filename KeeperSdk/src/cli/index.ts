import { registerCliCommand } from './registry'
import { foldersCommand } from './commands/folders'
import { helpCommand } from './commands/help'
import { loginCommand } from './commands/login'
import { logoutCommand } from './commands/logout'
import { recordsCommand } from './commands/records'
import { registerDeviceCommand } from './commands/registerDevice'
import { restoreSessionCommand } from './commands/restoreSession'
import { syncCommand } from './commands/sync'

let registryInitialized = false

/** Register built-in Keeper CLI commands (idempotent). */
export function ensureKeeperCliRegistry(): void {
    if (registryInitialized) return
    registryInitialized = true
    registerCliCommand(helpCommand)
    registerCliCommand(loginCommand)
    registerCliCommand(registerDeviceCommand)
    registerCliCommand(restoreSessionCommand)
    registerCliCommand(syncCommand)
    registerCliCommand(recordsCommand)
    registerCliCommand(foldersCommand)
    registerCliCommand(logoutCommand)
}

ensureKeeperCliRegistry()

export type {
    CliResult,
    ParsedCli,
    CliHelpDoc,
    CliCommandDefinition,
    KeeperCliHost,
    KeeperCliVault,
} from './types'

export {
    tokenizeArguments,
    parseCliArgs,
    hasOpt,
    getOpt,
    wantsCliHelp,
    rejectUnknownOptions,
} from './parse'

export {
    formatDetailedHelp,
    formatDetailedHelpForCommand,
    formatAllCommandsSummary,
    formatShortCommandSummary,
} from './help'
import { getDetailedHelpPageForRegistry } from './help'
import { listCliCommands } from './registry'

export function getDetailedHelpPage(name: string): string | null {
    ensureKeeperCliRegistry()
    return getDetailedHelpPageForRegistry(listCliCommands(), name)
}

export { KEEPER_VAULT_SURFACE } from './vaultSurface'

export {
    registerCliCommand,
    registerCliAlias,
    resolveCliCommandName,
    getCliCommand,
    listCliCommands,
    listCliCommandNames,
    listDocumentedCommands,
    clearCliRegistry,
} from './registry'

export { dispatchKeeperCli, dispatchCliLine } from './dispatch'

export {
    runLoginCommand,
    loginWithCredentials,
    loginWithSessionToken,
    ensureLoggedIn,
    loginCommand,
} from './commands/login'

export { runLogoutCommand, logoutCommand } from './commands/logout'
export { recordsCommand } from './commands/records'
export { foldersCommand } from './commands/folders'
export { registerDeviceCommand } from './commands/registerDevice'
export { helpCommand } from './commands/help'
export { restoreSessionCommand } from './commands/restoreSession'
export { syncCommand, runVaultSync } from './commands/sync'

export { utf8ToBase64Url, recordUid } from './utils'

export type { SessionRestoreInput } from '../auth/sessionRestore'
export {
    toSessionParams,
    validateSessionRestoreInput,
    sessionRestoreFromJson,
    resolveSessionRestorePayload,
} from '../auth/sessionRestore'
