import type { DSharedFolder } from '@keeper-security/keeperapi'
import type { CliCommandDefinition, CliResult, KeeperCliHost, ParsedCli } from '../types'
import { hasOpt, wantsCliHelp } from '../parse'
import { formatDetailedHelpForCommand } from '../help'
import { ensureCapability, ensureSession } from '../commandHelpers'
import { formatTable } from '../table'

const SUBCOMMANDS = ['list', 'tree', 'ls', 'pwd', 'cd', 'mkdir', 'rename', 'rmdir', 'get'] as const
type Sub = (typeof SUBCOMMANDS)[number]

async function runListShared(host: KeeperCliHost): Promise<CliResult> {
    const r = await ensureSession(host)
    if (r) return r
    const v = host.getVault()
    await v.sync()
    const folders = v.getSharedFolders()
    if (folders.length === 0) return { code: 0, out: '(no shared folders)\n', err: '' }
    const rows = folders.map((f: DSharedFolder) => [f.uid ?? '(unknown uid)', f.name ?? '(unnamed)'])
    return { code: 0, out: formatTable(['shared_folder_uid', 'name'], rows), err: '' }
}

async function runTree(host: KeeperCliHost): Promise<CliResult> {
    const r = await ensureSession(host)
    if (r) return r
    const v = host.getVault()
    const cap = ensureCapability(v, 'tree', 'tree')
    if (cap) return cap
    await v.sync()
    const out = await v.tree!()
    return { code: 0, out: out.endsWith('\n') ? out : out + '\n', err: '' }
}

async function runLs(host: KeeperCliHost, parsed: ParsedCli): Promise<CliResult> {
    const r = await ensureSession(host)
    if (r) return r
    const v = host.getVault()
    const cap = ensureCapability(v, 'listFolder', 'ls')
    if (cap) return cap
    await v.sync()
    const target = parsed.positional[1]
    const detail = hasOpt(parsed.opts, 'detail')

    if (!target) {
        const result = await v.listFolder!({ detail })
        return { code: 0, out: formatLs(result, detail), err: '' }
    }

    if (!v.changeDirectory || !v.getCurrentFolderUid) {
        return { code: 1, out: '', err: 'folders ls <path>: host lacks navigation capabilities.\n' }
    }

    // Snapshot cwd, resolve via cd, list, then restore. ls is read-only;
    // path resolution should never leave the session somewhere new.
    const originalUid = v.getCurrentFolderUid()
    let resolvedUid: string | null
    try {
        const cd = await v.changeDirectory(target)
        resolvedUid = cd.folderUid
    } catch (e) {
        return { code: 1, out: '', err: host.formatError(`folders ls ${target}`, e) }
    }
    try {
        const result = await v.listFolder!({ folderUid: resolvedUid ?? null, detail })
        return { code: 0, out: formatLs(result, detail), err: '' }
    } finally {
        if (resolvedUid !== originalUid) {
            try {
                await v.changeDirectory(originalUid ?? '/')
            } catch {
                // best-effort restore; user can `folders cd /` if needed
            }
        }
    }
}

function formatLs(
    result: {
        detail: boolean
        folders: Array<{ uid: string; name: string }>
        records: Array<{ uid: string; name: string; type?: string }>
    },
    detail: boolean
): string {
    if (result.folders.length + result.records.length === 0) return '(empty)\n'

    const headers = detail ? ['flags', 'uid', 'name', 'type'] : ['kind', 'uid', 'name']
    const rows: string[][] = []
    for (const f of result.folders) {
        const flags = ((f as { flags?: string }).flags ?? '').trim()
        rows.push(detail ? [flags || 'f---', f.uid, f.name, ''] : ['dir', f.uid, f.name])
    }
    for (const r of result.records) {
        const flags = ((r as { flags?: string }).flags ?? '').trim()
        const type = r.type ?? ''
        rows.push(detail ? [flags || 'r---', r.uid, r.name, type] : ['rec', r.uid, r.name])
    }
    return formatTable(headers, rows)
}

async function runPwd(host: KeeperCliHost): Promise<CliResult> {
    const r = await ensureSession(host)
    if (r) return r
    const v = host.getVault()
    const cap = ensureCapability(v, 'getWorkingFolderDisplayName', 'pwd')
    if (cap) return cap
    return { code: 0, out: `${v.getWorkingFolderDisplayName!()}\n`, err: '' }
}

async function runCd(host: KeeperCliHost, parsed: ParsedCli): Promise<CliResult> {
    const target = parsed.positional[1]
    if (!target) return { code: 1, out: '', err: 'folders cd: missing path. Usage: folders cd <path>\n' }
    const r = await ensureSession(host)
    if (r) return r
    const v = host.getVault()
    const cap = ensureCapability(v, 'changeDirectory', 'cd')
    if (cap) return cap
    try {
        const res = await v.changeDirectory!(target)
        return { code: 0, out: `${res.name}\n`, err: '' }
    } catch (e) {
        return { code: 1, out: '', err: host.formatError(`folders cd ${target}`, e) }
    }
}

async function runMkdir(host: KeeperCliHost, parsed: ParsedCli): Promise<CliResult> {
    const target = parsed.positional[1]
    if (!target) {
        return {
            code: 1,
            out: '',
            err: 'folders mkdir: missing path. Usage: folders mkdir <path> [--shared]\n',
        }
    }
    const r = await ensureSession(host)
    if (r) return r
    const v = host.getVault()
    const cap = ensureCapability(v, 'mkdir', 'mkdir')
    if (cap) return cap
    const cwd = v.getWorkingFolderDisplayName?.() ?? '(root)'
    try {
        const res = await v.mkdir!(target, { sharedFolder: hasOpt(parsed.opts, 'shared') })
        if (!res.success) {
            return { code: 1, out: '', err: `folders mkdir [in ${cwd}]: ${res.message ?? 'failed'}\n` }
        }
        return { code: 0, out: `${res.folderUid}\t${target} (in ${cwd})\n`, err: '' }
    } catch (e) {
        return { code: 1, out: '', err: host.formatError(`folders mkdir ${target} [in ${cwd}]`, e) }
    }
}

async function runRename(host: KeeperCliHost, parsed: ParsedCli): Promise<CliResult> {
    const path = parsed.positional[1]
    const newName = parsed.positional[2]
    if (!path || !newName) {
        return {
            code: 1,
            out: '',
            err: 'folders rename: usage: folders rename <path> <new-name>\n',
        }
    }
    const r = await ensureSession(host)
    if (r) return r
    const v = host.getVault()
    const cap = ensureCapability(v, 'renameFolder', 'folders rename')
    if (cap) return cap
    try {
        const res = await v.renameFolder!(path, newName)
        if (!res.success) {
            return { code: 1, out: '', err: `folders rename: ${res.message ?? 'failed'}\n` }
        }
        return { code: 0, out: `renamed ${path} → ${newName}\n`, err: '' }
    } catch (e) {
        return { code: 1, out: '', err: host.formatError(`folders rename ${path}`, e) }
    }
}

async function runRmdir(host: KeeperCliHost, parsed: ParsedCli): Promise<CliResult> {
    const pattern = parsed.positional[1]
    if (!pattern) {
        return { code: 1, out: '', err: 'folders rmdir: missing path. Usage: folders rmdir <path>\n' }
    }
    const r = await ensureSession(host)
    if (r) return r
    const v = host.getVault()
    const cap = ensureCapability(v, 'rmdir', 'folders rmdir')
    if (cap) return cap
    try {
        const res = await v.rmdir!([pattern])
        if (!res.success) {
            return { code: 1, out: '', err: `folders rmdir: ${res.message ?? 'failed'}\n` }
        }
        return { code: 0, out: `removed ${pattern}\n`, err: '' }
    } catch (e) {
        return { code: 1, out: '', err: host.formatError(`folders rmdir ${pattern}`, e) }
    }
}

async function runGet(host: KeeperCliHost, parsed: ParsedCli): Promise<CliResult> {
    const target = parsed.positional[1]
    if (!target) return { code: 1, out: '', err: 'folders get: missing UID or name. Usage: folders get <uid|name>\n' }
    const r = await ensureSession(host)
    if (r) return r
    const v = host.getVault()
    const cap = ensureCapability(v, 'getFolder', 'get')
    if (cap) return cap
    try {
        const res = await v.getFolder!(target, { format: 'json' })
        const json = (res as { json?: Record<string, unknown> }).json ?? res
        return { code: 0, out: JSON.stringify(json, null, 2) + '\n', err: '' }
    } catch (e) {
        return { code: 1, out: '', err: host.formatError(`folders get ${target}`, e) }
    }
}

export const foldersCommand: CliCommandDefinition = {
    name: 'folders',
    order: 31,
    description: 'List/navigate vault folders (list, tree, ls, pwd, cd, mkdir, rename, rmdir, get).',
    usage: 'folders [list|tree|ls|pwd|cd|mkdir|rename|rmdir|get] [args] [--help|-h]',
    subcommands: [...SUBCOMMANDS],
    flagOptions: ['--shared', '--detail'],
    help: {
        title: 'folders — navigate and inspect vault folders',
        synopsis: `  folders [list]                    Top-level shared folders (uid + name)
  folders tree                      Render the full folder tree
  folders ls [PATH] [--detail]      Contents of a folder (default: current)
  folders pwd                       Print current working folder display name
  folders cd PATH                   Change current folder
  folders mkdir PATH [--shared]     Create a user (or shared) folder
  folders rename PATH NEW_NAME      Rename a folder
  folders rmdir PATH                Delete a folder
  folders get UID|NAME              Print folder details as JSON`,
        description: `  Folder navigation maintained per-shell. The current folder affects
  subsequent ls, mkdir, and other folder-relative operations.

  PATH is a slash-separated sequence of folder names or UIDs (e.g.
  "Marketing/Q3" or "AAAA-bbbb-uid"). "/" is the vault root.

  list (default) calls sync() then enumerates shared folders only —
  useful for a quick top-level view. Use tree or ls for full contents.`,
        arguments: `  list      (default) Print shared_folder_uid + name for top-level shared folders.
  tree      Render the full folder tree (folders + records) as ASCII.
  ls PATH   List immediate children (folders + records). Default: current folder.
  pwd       Print the current working folder.
  cd PATH   Change current folder. "/" returns to root.
  mkdir PATH [--shared]   Create a folder. --shared makes it a shared folder.
  rename PATH NEW_NAME    Rename a folder under cwd or by path.
  rmdir PATH              Delete a folder (by path or name).
  get UID|NAME            Print folder metadata as JSON.`,
        options: `  --detail        ls only: include flags, record types, ownership.
  --shared        mkdir only: create a shared folder instead of a user folder.
  --help, -h      Show this help.`,
        examples: `  folders                           # shared folders quick list
  folders tree                      # full tree
  folders ls Marketing              # contents of Marketing
  folders cd Marketing/Q3           # navigate
  folders mkdir Drafts              # user folder under cwd
  folders mkdir Public --shared     # new shared folder under cwd
  folders get aaaa-bbbb-uid         # folder details as JSON`,
        seeAlso: '  records list, sync, login, restore-session',
    },
    async run(host, parsed) {
        if (wantsCliHelp(parsed)) {
            return { code: 0, out: formatDetailedHelpForCommand(foldersCommand), err: '' }
        }
        const sub = (parsed.positional[0]?.toLowerCase() ?? 'list') as Sub
        if (!SUBCOMMANDS.includes(sub)) {
            return {
                code: 1,
                out: '',
                err: `folders: unknown subcommand "${parsed.positional[0]}". Try: folders --help\n`,
            }
        }
        try {
            switch (sub) {
                case 'list':
                    return await runListShared(host)
                case 'tree':
                    return await runTree(host)
                case 'ls':
                    return await runLs(host, parsed)
                case 'pwd':
                    return await runPwd(host)
                case 'cd':
                    return await runCd(host, parsed)
                case 'mkdir':
                    return await runMkdir(host, parsed)
                case 'rename':
                    return await runRename(host, parsed)
                case 'rmdir':
                    return await runRmdir(host, parsed)
                case 'get':
                    return await runGet(host, parsed)
            }
        } catch (e) {
            return { code: 1, out: '', err: host.formatError(`folders ${sub}`, e) }
        }
    },
}
