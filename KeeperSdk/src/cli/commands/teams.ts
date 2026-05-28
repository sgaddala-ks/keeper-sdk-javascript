import type { CliCommandDefinition, CliResult, KeeperCliHost, KeeperCliVault, ParsedCli } from '../types'
import { getOpt, hasOpt, wantsCliHelp } from '../parse'
import { formatDetailedHelpForCommand } from '../help'
import { ensureCapability, ensureSession } from '../commandHelpers'
import { formatTeamsTable, renderTeamsAsciiTable } from '../../teams/listTeams'
import { formatTeamView, teamViewTable } from '../../teams/viewTeam'

const SUBCOMMANDS = ['list', 'view'] as const
type Sub = (typeof SUBCOMMANDS)[number]

async function runList(host: KeeperCliHost, parsed: ParsedCli): Promise<CliResult> {
    const r = await ensureSession(host)
    if (r) return r
    const v = host.getVault()
    const cap = ensureCapability(v, 'listTeams', 'teams list')
    if (cap) return cap
    await v.sync!()
    const pattern = getOpt(parsed.opts, 'pattern') ?? null
    const rows = await v.listTeams!({ pattern })
    if (hasOpt(parsed.opts, 'json')) {
        return { code: 0, out: JSON.stringify(rows, null, 2) + '\n', err: '' }
    }
    if (rows.length === 0) {
        return {
            code: 0,
            out: pattern ? `(no teams matched "${pattern}")\n` : '(no teams)\n',
            err: '',
        }
    }
    const table = formatTeamsTable(rows)
    return { code: 0, out: renderTeamsAsciiTable(table) + '\n', err: '' }
}

async function runView(host: KeeperCliHost, parsed: ParsedCli): Promise<CliResult> {
    const id = parsed.positional[1]
    if (!id) {
        return { code: 1, out: '', err: 'teams view: missing team name or UID. Usage: teams view <name|uid>\n' }
    }
    const r = await ensureSession(host)
    if (r) return r
    const v = host.getVault()
    const cap = ensureCapability(v, 'viewTeam', 'teams view')
    if (cap) return cap
    const view = await v.viewTeam!(id)
    if (hasOpt(parsed.opts, 'json')) {
        return { code: 0, out: JSON.stringify(view, null, 2) + '\n', err: '' }
    }
    const formatted = formatTeamView(view, { verbose: hasOpt(parsed.opts, 'verbose') })
    return { code: 0, out: teamViewTable(formatted) + '\n', err: '' }
}

export const teamsCommand: CliCommandDefinition = {
    name: 'teams',
    order: 40,
    description: 'Enterprise teams (list, view).',
    usage: 'teams list|view [args] [--pattern P] [--json] [--verbose] [--help|-h]',
    subcommands: [...SUBCOMMANDS],
    flagOptions: ['--pattern', '--json', '--verbose'],
    help: {
        title: 'teams — list and inspect enterprise teams',
        synopsis: `  teams list [--pattern P] [--json]
  teams view NAME|UID [--json] [--verbose]`,
        description:
            '  Requires an enterprise account. list loads teams; view shows one team with roles and users.',
        arguments: `  list    Table of teams (default columns: restricts, node, user/role counts).
  view    Details for one team by name or team_uid.`,
        options: `  --pattern     list only: filter by name/uid substring.
  --json        Emit JSON instead of a table.
  --verbose     view only: include numeric node/user/role ids.
  --help, -h    Show this help.`,
        examples: `  teams list
  teams list --pattern eng
  teams view "Engineering" --verbose`,
        seeAlso: '  users list, sync, login',
    },
    async run(host, parsed) {
        if (wantsCliHelp(parsed)) {
            return { code: 0, out: formatDetailedHelpForCommand(teamsCommand), err: '' }
        }
        const sub = (parsed.positional[0]?.toLowerCase() ?? 'list') as Sub
        if (!SUBCOMMANDS.includes(sub)) {
            return {
                code: 1,
                out: '',
                err: `teams: unknown subcommand "${parsed.positional[0]}". Try: teams --help\n`,
            }
        }
        try {
            switch (sub) {
                case 'list':
                    return await runList(host, parsed)
                case 'view':
                    return await runView(host, parsed)
            }
        } catch (e) {
            return { code: 1, out: '', err: host.formatError(`teams ${sub}`, e) }
        }
    },
}
