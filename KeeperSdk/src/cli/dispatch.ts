import type { CliResult, KeeperCliHost, ParsedCli } from './types'
import { parseCliArgs, tokenizeArguments, wantsCliHelp } from './parse'
import { extractFromJsonFlagValue } from './jsonArg'
import { RESTORE_SESSION_TRAILING_OPTS } from './commands/restoreSession'
import { formatDetailedHelpForCommand } from './help'
import { getCliCommand } from './registry'

export async function dispatchKeeperCli(
    commandName: string,
    args: string[],
    host: KeeperCliHost,
    preParsed?: ParsedCli
): Promise<CliResult> {
    const def = getCliCommand(commandName)
    if (!def) {
        return { code: 1, out: '', err: `Unknown command: ${commandName}\n` }
    }
    const parsed = preParsed ?? parseCliArgs(args)
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
    const args = tokens.slice(1)
    let preParsed: ParsedCli | undefined
    if (name === 'restore-session') {
        const json = extractFromJsonFlagValue(trimmed, 'from-json', RESTORE_SESSION_TRAILING_OPTS)
        if (json) {
            preParsed = parseCliArgs(args)
            preParsed.opts.set('from-json', json)
        }
    }
    return dispatchKeeperCli(name, args, host, preParsed)
}
