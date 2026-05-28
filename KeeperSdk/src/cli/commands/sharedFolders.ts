import type { CliCommandDefinition, CliResult, KeeperCliHost, ParsedCli } from '../types'
import { getOpt, hasOpt, wantsCliHelp } from '../parse'
import { formatDetailedHelpForCommand } from '../help'
import { ensureCapability, ensureSession } from '../commandHelpers'
import { formatSharedFoldersTable, renderSharedFoldersAsciiTable } from '../../sharedFolders/listSharedFolders'

async function runList(host: KeeperCliHost, parsed: ParsedCli): Promise<CliResult> {
    const r = await ensureSession(host)
    if (r) return r
    const v = host.getVault()
    const cap = ensureCapability(v, 'listSharedFolders', 'shared-folders list')
    if (cap) return cap
    await v.sync!()
    const pattern = getOpt(parsed.opts, 'pattern') ?? null
    const verbose = hasOpt(parsed.opts, 'verbose')
    const rows = v.listSharedFolders!({ pattern, verbose, includeDetails: verbose })
    if (hasOpt(parsed.opts, 'json')) {
        return { code: 0, out: JSON.stringify(rows, null, 2) + '\n', err: '' }
    }
    if (rows.length === 0) {
        return {
            code: 0,
            out: pattern ? `(no shared folders matched "${pattern}")\n` : '(no shared folders)\n',
            err: '',
        }
    }
    const table = formatSharedFoldersTable(rows, { verbose })
    return { code: 0, out: renderSharedFoldersAsciiTable(table) + '\n', err: '' }
}

export const sharedFoldersCommand: CliCommandDefinition = {
    name: 'shared-folders',
    order: 32,
    description: 'List shared folders (with optional counts).',
    usage: 'shared-folders [list] [--pattern P] [--verbose] [--json] [--help|-h]',
    subcommands: ['list'],
    flagOptions: ['--pattern', '--verbose', '--json'],
    help: {
        title: 'shared-folders — list shared folders in the vault',
        synopsis: '  shared-folders [list] [--pattern P] [--verbose] [--json]',
        description:
            '  Unlike `folders list` (uid + name only), this command can include team/user/record counts with --verbose.',
        arguments: '  list    (default) List shared folders.',
        options: `  --pattern     Filter by name or uid substring.
  --verbose     Include team/user/record counts and default permissions.
  --json        Emit JSON.
  --help, -h    Show this help.`,
        examples: `  shared-folders
  shared-folders list --pattern marketing --verbose`,
        seeAlso: '  folders list, folders ls, sync',
    },
    async run(host, parsed) {
        if (wantsCliHelp(parsed)) {
            return { code: 0, out: formatDetailedHelpForCommand(sharedFoldersCommand), err: '' }
        }
        const sub = parsed.positional[0]?.toLowerCase()
        if (sub && sub !== 'list') {
            return { code: 1, out: '', err: 'Usage: shared-folders [list]\n' }
        }
        try {
            return await runList(host, parsed)
        } catch (e) {
            return { code: 1, out: '', err: host.formatError('shared-folders', e) }
        }
    },
}
