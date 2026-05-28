import type { CliCommandDefinition, CliResult, KeeperCliHost, ParsedCli } from '../types'
import { getOpt, hasOpt, wantsCliHelp } from '../parse'
import { formatDetailedHelpForCommand } from '../help'
import { ensureCapability, ensureSession } from '../commandHelpers'
import {
    formatUsersTable,
    renderUsersAsciiTable,
    SUPPORTED_USER_COLUMNS,
} from '../../users/listUsers'
import type { UserColumnInput } from '../../users/userTypes'
import { formatUserView, userViewTable } from '../../users/viewUser'

const SUBCOMMANDS = ['list', 'view'] as const
type Sub = (typeof SUBCOMMANDS)[number]

function parseColumns(raw: string | undefined): UserColumnInput[] | '*' | undefined {
    const trimmed = raw?.trim()
    if (!trimmed) return undefined
    if (trimmed === '*') return '*'
    return trimmed
        .split(',')
        .map((p) => p.trim())
        .filter((p) => p.length > 0) as UserColumnInput[]
}

async function runList(host: KeeperCliHost, parsed: ParsedCli): Promise<CliResult> {
    const r = await ensureSession(host)
    if (r) return r
    const v = host.getVault()
    const cap = ensureCapability(v, 'listUsers', 'users list')
    if (cap) return cap
    await v.sync!()
    const pattern = getOpt(parsed.opts, 'pattern') ?? null
    const columns = parseColumns(getOpt(parsed.opts, 'columns'))
    const rows = await v.listUsers!({ pattern, columns })
    if (hasOpt(parsed.opts, 'json')) {
        return { code: 0, out: JSON.stringify(rows, null, 2) + '\n', err: '' }
    }
    if (rows.length === 0) {
        return {
            code: 0,
            out: pattern ? `(no users matched "${pattern}")\n` : '(no users)\n',
            err: '',
        }
    }
    const table = formatUsersTable(rows, { columns })
    return { code: 0, out: renderUsersAsciiTable(table) + '\n', err: '' }
}

async function runView(host: KeeperCliHost, parsed: ParsedCli): Promise<CliResult> {
    const id = parsed.positional[1]
    if (!id) {
        return { code: 1, out: '', err: 'users view: missing email or user id. Usage: users view <email|id>\n' }
    }
    const r = await ensureSession(host)
    if (r) return r
    const v = host.getVault()
    const cap = ensureCapability(v, 'viewUser', 'users view')
    if (cap) return cap
    const view = await v.viewUser!(id)
    if (hasOpt(parsed.opts, 'json')) {
        return { code: 0, out: JSON.stringify(view, null, 2) + '\n', err: '' }
    }
    const formatted = formatUserView(view, { verbose: hasOpt(parsed.opts, 'verbose') })
    return { code: 0, out: userViewTable(formatted) + '\n', err: '' }
}

export const usersCommand: CliCommandDefinition = {
    name: 'users',
    order: 41,
    description: 'Enterprise users (list, view).',
    usage: 'users list|view [args] [--pattern P] [--columns C] [--json] [--verbose] [--help|-h]',
    subcommands: [...SUBCOMMANDS],
    flagOptions: ['--pattern', '--columns', '--json', '--verbose'],
    help: {
        title: 'users — list and inspect enterprise users',
        synopsis: `  users list [--pattern P] [--columns cols]
  users view EMAIL|ID [--json] [--verbose]`,
        description: '  Requires an enterprise account.',
        arguments: `  list    Table of enterprise users.
  view    Details for one user by email or enterprise_user_id.`,
        options: `  --pattern     list only: filter by name/email substring.
  --columns     list only: comma-separated columns or * (supported: ${SUPPORTED_USER_COLUMNS.join(', ')}).
  --json        Emit JSON instead of a table.
  --verbose     view only: include UIDs in team/role rows.
  --help, -h    Show this help.`,
        examples: `  users list
  users list --pattern @acme.com --columns name,status,node
  users view user@example.com`,
        seeAlso: '  teams list, sync, login',
    },
    async run(host, parsed) {
        if (wantsCliHelp(parsed)) {
            return { code: 0, out: formatDetailedHelpForCommand(usersCommand), err: '' }
        }
        const sub = (parsed.positional[0]?.toLowerCase() ?? 'list') as Sub
        if (!SUBCOMMANDS.includes(sub)) {
            return {
                code: 1,
                out: '',
                err: `users: unknown subcommand "${parsed.positional[0]}". Try: users --help\n`,
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
            return { code: 1, out: '', err: host.formatError(`users ${sub}`, e) }
        }
    },
}
