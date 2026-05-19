import type { CliResult, KeeperCliHost } from './types'
import { parseCliArgs, tokenizeArguments, wantsCliHelp } from './parse'
import { formatDetailedHelpForCommand } from './help'
import { getCliCommand } from './registry'

export async function dispatchKeeperCli(
    commandName: string,
    args: string[],
    host: KeeperCliHost
): Promise<CliResult> {
    const def = getCliCommand(commandName)
    if (!def) {
        return { code: 1, out: '', err: `Unknown command: ${commandName}\n` }
    }
    const parsed = parseCliArgs(args)
    if (wantsCliHelp(parsed)) {
        return { code: 0, out: formatDetailedHelpForCommand(def), err: '' }
    }
    return def.run(host, parsed)
}

export async function dispatchCliLine(line: string, host: KeeperCliHost): Promise<CliResult> {
    const trimmed = line.trim()
    if (!trimmed) {
        return { code: 0, out: '', err: '' }
    }
    const tokens = tokenizeArguments(trimmed)
    const name = tokens[0]?.toLowerCase()
    if (!name) {
        return { code: 0, out: '', err: '' }
    }
    return dispatchKeeperCli(name, tokens.slice(1), host)
}
