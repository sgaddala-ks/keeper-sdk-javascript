import { registerCliCommand } from '../registry'
import { getCommand } from './get'
import { cdCommand, lsCommand, mkdirCommand, treeCommand } from './nav'
import { listSfCommand, listTeamCommand, searchCommand, whoamiCommand } from './misc'

export { getCommand } from './get'
export { executeGet } from './getCore'
export { lsCommand, cdCommand, treeCommand, mkdirCommand } from './nav'
export { searchCommand, listSfCommand, listTeamCommand, whoamiCommand } from './misc'

const COMMANDER_COMMANDS = [
    getCommand,
    lsCommand,
    cdCommand,
    treeCommand,
    mkdirCommand,
    searchCommand,
    listSfCommand,
    listTeamCommand,
    whoamiCommand,
]

/** Register top-level Keeper Commander-style vault commands (JS SDK under the hood). */
export function registerCommanderCliCommands(): void {
    for (const def of COMMANDER_COMMANDS) {
        registerCliCommand(def)
    }
}
