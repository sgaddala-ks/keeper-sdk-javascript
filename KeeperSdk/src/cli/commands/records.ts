import { getRecordTitle } from '../../records/RecordUtils'
import type { CliCommandDefinition, KeeperCliHost, ParsedCli } from '../types'
import { wantsCliHelp } from '../parse'
import { formatDetailedHelpForCommand } from '../help'
import { recordUid } from '../utils'
import { ensureLoggedIn } from './login'

export const recordsCommand: CliCommandDefinition = {
    name: 'records',
    order: 30,
    description: 'List vault records (uid and title).',
    usage: 'records [list] [--help|-h]',
    subcommands: ['list'],
    help: {
        title: 'records — list vault records (record UID and title)',
        synopsis: '  records [list]',
        description: '  Runs sync, then prints a table of record_uid and title for each record.',
        arguments: '  list    Optional; default behavior is to list. Other subcommands may be added later.',
        options: '  --help, -h    Show this help.',
    },
    async run(host, parsed) {
        if (wantsCliHelp(parsed)) {
            return { code: 0, out: formatDetailedHelpForCommand(recordsCommand), err: '' }
        }
        if (parsed.opts.size > 0) {
            return { code: 1, out: '', err: 'records: unknown option (try: records --help)\n' }
        }
        const sub = parsed.positional[0]?.toLowerCase()
        if (parsed.positional.length > 1) {
            return { code: 1, out: '', err: 'Usage: records [list]\n' }
        }
        if (sub && sub !== 'list') {
            return { code: 1, out: '', err: 'Usage: records [list]\n' }
        }
        try {
            const v = host.getVault()
            if (!v.isLoggedIn) {
                const r = await ensureLoggedIn(host)
                if (r.code !== 0) return r
            }
            await v.sync()
            const records = v.getRecords()
            const rows = records.map((r) => `${recordUid(r)}\t${getRecordTitle(r)}`)
            const header = 'record_uid\ttitle\n'
            const body = rows.length ? rows.join('\n') + '\n' : '(no records)\n'
            return { code: 0, out: header + body, err: '' }
        } catch (e) {
            return { code: 1, out: '', err: host.formatError('records', e) }
        }
    },
}
