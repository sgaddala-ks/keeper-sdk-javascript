import type { CliCommandDefinition } from './types'
import { registerCliCommand } from './registry'
import { foldersCommand } from './commands/folders'
import { helpCommand } from './commands/help'
import { loginCommand } from './commands/login'
import { logoutCommand } from './commands/logout'
import { recordsCommand } from './commands/records'
import { registerDeviceCommand } from './commands/registerDevice'
import { restoreSessionCommand } from './commands/restoreSession'
import { sharedFoldersCommand } from './commands/sharedFolders'
import { syncCommand } from './commands/sync'
import { teamsCommand } from './commands/teams'
import { usersCommand } from './commands/users'
import { vaultCommand } from './commands/vault'
import { getCommand } from './commander/get'
import { cdCommand, lsCommand, mkdirCommand, treeCommand } from './commander/nav'
import { listSfCommand, listTeamCommand, searchCommand, whoamiCommand } from './commander/misc'

export const BUILTIN_CLI_COMMANDS: readonly CliCommandDefinition[] = [
    helpCommand,
    loginCommand,
    registerDeviceCommand,
    restoreSessionCommand,
    syncCommand,
    vaultCommand,
    getCommand,
    lsCommand,
    cdCommand,
    treeCommand,
    mkdirCommand,
    searchCommand,
    listSfCommand,
    listTeamCommand,
    whoamiCommand,
    recordsCommand,
    foldersCommand,
    sharedFoldersCommand,
    teamsCommand,
    usersCommand,
    logoutCommand,
]

export function registerBuiltinCliCommands(): void {
    for (const def of BUILTIN_CLI_COMMANDS) {
        registerCliCommand(def)
    }
}
