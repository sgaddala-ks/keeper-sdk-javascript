import type { CliCommandDefinition, KeeperCliHost } from '../types'
import { wantsCliHelp } from '../parse'
import {
    formatAllCommandsSummary,
    formatDetailedHelpForCommand,
    formatShortCommandSummary,
    getDetailedHelpPageForRegistry,
} from '../help'
import { listCliCommands } from '../registry'

export const helpCommand: CliCommandDefinition = {
    name: 'help',
    order: 0,
    description: 'Show all commands, or full docs for one command (same as COMMAND --help).',
    usage: 'help [command]  (see also: help --help)',
    help: {
        title: 'help — show commands or short syntax for one command',
        synopsis: '  help [COMMAND]',
        description: `  Without arguments, lists every built-in command with a one-line summary.
  With COMMAND, prints the same overview line plus usage for that command.

  For full documentation on each command, run:
    COMMAND --help
    COMMAND -h`,
        options: '  None. This command does not take GNU-style flags.',
        seeAlso: '  Each command’s --help output.',
    },
    async run(_host, parsed) {
        if (wantsCliHelp(parsed)) {
            return { code: 0, out: formatDetailedHelpForCommand(helpCommand), err: '' }
        }
        if (parsed.opts.size > 0) {
            return { code: 1, out: '', err: 'help: unknown option (try `help --help`)\n' }
        }
        const args = parsed.positional
        if (args.length === 0) {
            return { code: 0, out: formatAllCommandsSummary(listCliCommands()), err: '' }
        }
        if (args.length > 1) {
            return { code: 1, out: '', err: 'Usage: help [command]\n' }
        }
        const name = args[0]
        const long = getDetailedHelpPageForRegistry(listCliCommands(), name)
        if (long) {
            return { code: 0, out: long, err: '' }
        }
        const commands = listCliCommands()
        const def = commands.find((c) => c.name === name.toLowerCase())
        if (!def) {
            return { code: 1, out: '', err: `help: unknown command: ${name}\n` }
        }
        return { code: 0, out: formatShortCommandSummary(def), err: '' }
    },
}
