import type { CliCommandDefinition, CliResult, KeeperCliHost, ParsedCli } from './types'
import { parseCliArgs, tokenizeArguments, wantsCliHelp } from './parse'
import { extractFromJsonFlagValue } from './jsonArg'
import { RESTORE_SESSION_TRAILING_OPTS } from './commands/restoreSession'
import { formatAllCommandsSummary, formatDetailedHelpForCommand, formatShortCommandSummary } from './help'

export type KeeperCliParserOptions = {
    /** Program name used in usage strings (default `keeper`). */
    prog?: string
    /** One-line description shown above the command list. */
    description?: string
    /** Footer printed after the auto-generated command list. */
    epilog?: string
}

/**
 * Self-contained CLI parser modelled on Python `argparse.ArgumentParser` + `add_subparsers()`.
 *
 * Add commands once, then call {@link parse} to dispatch a CLI line. `--help` (or `-h`) at the
 * top level lists every registered subcommand; `<command> --help` prints that command's full
 * help page. The parser owns its own command set so multiple parsers can coexist (useful for
 * embedding subsets of the CLI in tools, tests, or scoped UIs).
 */
export class KeeperCliParser {
    private readonly prog: string
    private readonly description: string
    private readonly epilog?: string
    private readonly commands = new Map<string, CliCommandDefinition>()
    private readonly aliases = new Map<string, string>()

    constructor(options: KeeperCliParserOptions = {}) {
        this.prog = options.prog ?? 'keeper'
        this.description = options.description ?? ''
        this.epilog = options.epilog
    }

    /** Register one command (Commander/argparse `add_parser` equivalent). Returns `this` for chaining. */
    addCommand(def: CliCommandDefinition): this {
        const key = def.name.toLowerCase()
        this.commands.set(key, def)
        if (def.aliases) {
            for (const alias of def.aliases) {
                this.aliases.set(alias.toLowerCase(), key)
            }
        }
        return this
    }

    /** Register multiple commands at once. */
    addCommands(defs: Iterable<CliCommandDefinition>): this {
        for (const def of defs) this.addCommand(def)
        return this
    }

    /** All registered commands, ordered by `order` then name (same rule as the global registry). */
    list(): CliCommandDefinition[] {
        return [...this.commands.values()].sort((a, b) => {
            const oa = a.order ?? 500
            const ob = b.order ?? 500
            if (oa !== ob) return oa - ob
            return a.name.localeCompare(b.name)
        })
    }

    /** All registered command names, in `list()` order. */
    listNames(): string[] {
        return this.list().map((c) => c.name)
    }

    /** Resolve a name (or alias) to a command definition. */
    resolve(name: string): CliCommandDefinition | undefined {
        const key = name.toLowerCase()
        if (this.commands.has(key)) return this.commands.get(key)
        const target = this.aliases.get(key)
        return target ? this.commands.get(target) : undefined
    }

    /** Top-level help text: parser description + every registered subcommand. */
    formatHelp(): string {
        const header = this.description ? `${this.prog} — ${this.description}\n\n` : ''
        const body = formatAllCommandsSummary(this.list())
        const footer = this.epilog ? `\n${this.epilog}\n` : ''
        return header + body + footer
    }

    /** Full help page for one subcommand (same content as `<command> --help`). */
    formatCommandHelp(name: string): string | null {
        const def = this.resolve(name)
        return def ? formatDetailedHelpForCommand(def) : null
    }

    /** Short summary for one subcommand (single line + usage). */
    formatCommandSummary(name: string): string | null {
        const def = this.resolve(name)
        return def ? formatShortCommandSummary(def) : null
    }

    /**
     * Parse and dispatch a CLI line.
     *
     * Behaviour:
     * - empty / whitespace → top-level help (no error)
     * - `--help` / `-h` / `help` → top-level help
     * - `--help <cmd>` / `help <cmd>` → that command's help page
     * - `<cmd> --help` / `<cmd> -h` → that command's help page (handled before `def.run`)
     * - `<cmd> [args]` → run `def.run(host, parsed)`
     */
    async parse(line: string | readonly string[], host: KeeperCliHost): Promise<CliResult> {
        const { tokens, raw } = normalizeInput(line)
        if (tokens.length === 0) {
            return ok(this.formatHelp())
        }

        const first = tokens[0]
        const rest = tokens.slice(1)

        if (isHelpToken(first)) {
            const sub = rest[0]
            if (!sub) return ok(this.formatHelp())
            const page = this.formatCommandHelp(sub)
            if (page) return ok(page)
            return err(`${this.prog}: unknown command: ${sub}\nTry: ${this.prog} --help\n`)
        }

        const def = this.resolve(first)
        if (!def) {
            return err(`${this.prog}: unknown command: ${first}\nTry: ${this.prog} --help\n`)
        }

        let parsed: ParsedCli
        if (def.name === 'restore-session') {
            const json = extractFromJsonFlagValue(raw, 'from-json', RESTORE_SESSION_TRAILING_OPTS)
            parsed = parseCliArgs(rest)
            if (json) parsed.opts.set('from-json', json)
        } else {
            parsed = parseCliArgs(rest)
        }

        if (wantsCliHelp(parsed)) {
            return ok(formatDetailedHelpForCommand(def))
        }
        return def.run(host, parsed)
    }
}

/** Build a parser pre-loaded with the SDK's built-in commands (login, records, folders, …). */
export function createKeeperCliParser(options: KeeperCliParserOptions = {}): KeeperCliParser {
    const parser = new KeeperCliParser(options)
    void loadBuiltinsInto(parser)
    return parser
}

function loadBuiltinsInto(parser: KeeperCliParser): void {
    const { foldersCommand } = require('./commands/folders') as typeof import('./commands/folders')
    const { helpCommand } = require('./commands/help') as typeof import('./commands/help')
    const { loginCommand } = require('./commands/login') as typeof import('./commands/login')
    const { logoutCommand } = require('./commands/logout') as typeof import('./commands/logout')
    const { recordsCommand } = require('./commands/records') as typeof import('./commands/records')
    const {
        registerDeviceCommand,
    } = require('./commands/registerDevice') as typeof import('./commands/registerDevice')
    const {
        restoreSessionCommand,
    } = require('./commands/restoreSession') as typeof import('./commands/restoreSession')
    const { syncCommand } = require('./commands/sync') as typeof import('./commands/sync')

    parser.addCommands([
        helpCommand,
        loginCommand,
        registerDeviceCommand,
        restoreSessionCommand,
        syncCommand,
        recordsCommand,
        foldersCommand,
        logoutCommand,
    ])
}

function normalizeInput(line: string | readonly string[]): { tokens: string[]; raw: string } {
    if (typeof line === 'string') {
        const trimmed = line.trim()
        return { tokens: trimmed ? tokenizeArguments(trimmed) : [], raw: trimmed }
    }
    const tokens = [...line].filter((t) => t.length > 0)
    return { tokens, raw: tokens.join(' ') }
}

function isHelpToken(token: string): boolean {
    const t = token.toLowerCase()
    return t === '--help' || t === '-h' || t === 'help'
}

function ok(out: string): CliResult {
    return { code: 0, out, err: '' }
}

function err(message: string): CliResult {
    return { code: 1, out: '', err: message }
}
