import { formatRecord, getRecordTitle } from '../../records/RecordUtils'
import type { CliCommandDefinition, CliResult, KeeperCliHost, ParsedCli } from '../types'
import { getOpt, hasOpt, wantsCliHelp } from '../parse'
import { formatDetailedHelpForCommand } from '../help'
import { recordUid } from '../utils'
import { ensureCapability, ensureSession } from '../commandHelpers'
import { formatTable } from '../table'

const SUBCOMMANDS = ['list', 'get', 'find', 'share-info'] as const
type Sub = (typeof SUBCOMMANDS)[number]

async function runList(host: KeeperCliHost): Promise<CliResult> {
    const r = await ensureSession(host)
    if (r) return r
    const v = host.getVault()
    await v.sync()
    const records = v.getRecords()
    const rows = records.map((rec) => [recordUid(rec), getRecordTitle(rec)])
    const header = 'record_uid\ttitle\n'
    const body = rows.length ? rows.join('\n') + '\n' : '(no records)\n'
    return { code: 0, out: header + body, err: '' }
}

async function runGet(host: KeeperCliHost, parsed: ParsedCli): Promise<CliResult> {
    const target = parsed.positional[1]
    if (!target) {
        return { code: 1, out: '', err: 'records get: missing UID or title. Usage: records get <uid|title>\n' }
    }
    const r = await ensureSession(host)
    if (r) return r
    const v = host.getVault()
    const cap = ensureCapability(v, 'findRecord', 'records get')
    if (cap) return cap
    await v.sync()
    const record = v.findRecord!(target)
    if (!record) {
        return { code: 1, out: '', err: `records get: no record matching "${target}"\n` }
    }
    const detail = hasOpt(parsed.opts, 'detail')
    if (hasOpt(parsed.opts, 'json')) {
        return { code: 0, out: JSON.stringify(record, null, 2) + '\n', err: '' }
    }
    return { code: 0, out: formatRecord(record, detail) + '\n', err: '' }
}

async function runFind(host: KeeperCliHost, parsed: ParsedCli): Promise<CliResult> {
    const criteria = parsed.positional[1] ?? getOpt(parsed.opts, 'pattern')
    if (!criteria) {
        return {
            code: 1,
            out: '',
            err: 'records find: missing search text. Usage: records find <text>  or  records find --pattern <text>\n',
        }
    }
    const r = await ensureSession(host)
    if (r) return r
    const v = host.getVault()
    const cap = ensureCapability(v, 'findRecords', 'records find')
    if (cap) return cap
    await v.sync()
    const matches = v.findRecords!(criteria)
    if (hasOpt(parsed.opts, 'json')) {
        return { code: 0, out: JSON.stringify(matches, null, 2) + '\n', err: '' }
    }
    if (matches.length === 0) {
        return { code: 0, out: `(no records matched "${criteria}")\n`, err: '' }
    }
    const rows = matches.map((rec) => [recordUid(rec), getRecordTitle(rec)])
    return { code: 0, out: formatTable(['record_uid', 'title'], rows), err: '' }
}

async function runShareInfo(host: KeeperCliHost, parsed: ParsedCli): Promise<CliResult> {
    const target = parsed.positional[1]
    if (!target) {
        return {
            code: 1,
            out: '',
            err: 'records share-info: missing UID or title. Usage: records share-info <uid|title>\n',
        }
    }
    const r = await ensureSession(host)
    if (r) return r
    const v = host.getVault()
    if (!v.findRecord || !v.getRecordShareInfo) {
        return {
            code: 1,
            out: '',
            err: 'records share-info: host lacks findRecord or getRecordShareInfo.\n',
        }
    }
    await v.sync()
    const record = v.findRecord(target)
    if (!record?.uid) {
        return { code: 1, out: '', err: `records share-info: no record matching "${target}"\n` }
    }
    const info = await v.getRecordShareInfo(record.uid)
    if (!info) {
        return { code: 0, out: '(no share information)\n', err: '' }
    }
    return { code: 0, out: JSON.stringify(info, null, 2) + '\n', err: '' }
}

export const recordsCommand: CliCommandDefinition = {
    name: 'records',
    order: 30,
    description: 'Vault records (list, get, find, share-info).',
    usage: 'records list|get|find|share-info [args] [--detail] [--pattern] [--json] [--help|-h]',
    subcommands: [...SUBCOMMANDS],
    flagOptions: ['--detail', '--pattern', '--json'],
    help: {
        title: 'records — search and inspect vault records',
        synopsis: `  records [list]
  records get UID|TITLE [--detail] [--json]
  records find TEXT [--pattern TEXT] [--json]
  records share-info UID|TITLE`,
        description: '  list syncs and prints uid + title. get/find resolve by uid or title substring.',
        arguments: `  list          (default) Table of all records.
  get           One record (formatted text or --json).
  find          Search records by uid/title tokens.
  share-info    JSON share permissions for a record.`,
        options: `  --detail      get only: include extra fields in formatted output.
  --pattern     find only: same as positional search text.
  --json        JSON output (get, find, share-info).
  --help, -h    Show this help.`,
        examples: `  records list
  records get "My Login" --detail
  records find password
  records share-info abc123uid`,
        seeAlso: '  folders ls, vault summary, sync',
    },
    async run(host, parsed) {
        if (wantsCliHelp(parsed)) {
            return { code: 0, out: formatDetailedHelpForCommand(recordsCommand), err: '' }
        }
        const sub = (parsed.positional[0]?.toLowerCase() ?? 'list') as Sub
        if (!SUBCOMMANDS.includes(sub)) {
            return {
                code: 1,
                out: '',
                err: `records: unknown subcommand "${parsed.positional[0]}". Try: records --help\n`,
            }
        }
        try {
            switch (sub) {
                case 'list':
                    return await runList(host)
                case 'get':
                    return await runGet(host, parsed)
                case 'find':
                    return await runFind(host, parsed)
                case 'share-info':
                    return await runShareInfo(host, parsed)
            }
        } catch (e) {
            return { code: 1, out: '', err: host.formatError(`records ${sub}`, e) }
        }
    },
}
