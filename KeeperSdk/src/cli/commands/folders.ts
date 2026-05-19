import type { DSharedFolder } from '@keeper-security/keeperapi'
import type { CliCommandDefinition, KeeperCliHost } from '../types'
import { wantsCliHelp } from '../parse'
import { formatDetailedHelpForCommand } from '../help'
import { ensureLoggedIn } from './login'

export const foldersCommand: CliCommandDefinition = {
    name: 'folders',
    order: 31,
    description: 'List shared folders in the vault (uses env or `login --username …`).',
    usage: 'folders [list] [--help|-h]',
    subcommands: ['list'],
    help: {
        title: 'folders — list shared folders',
        synopsis: '  folders [list]',
        description: '  Runs sync, then prints shared_folder_uid and name for each shared folder.',
        arguments: '  list    Optional; default is list.',
        options: '  --help, -h    Show this help.',
        keeperSdk: `  Uses KeeperVault.sync(), getSharedFolders().
  Related: listSharedFolders, shareFolder, FolderManager / SharedFolderManager.`,
        appendVaultSurface: true,
    },
    async run(host, parsed) {
        if (wantsCliHelp(parsed)) {
            return { code: 0, out: formatDetailedHelpForCommand(foldersCommand), err: '' }
        }
        if (parsed.opts.size > 0) {
            return { code: 1, out: '', err: 'folders: unknown option (try: folders --help)\n' }
        }
        const sub = parsed.positional[0]?.toLowerCase()
        if (parsed.positional.length > 1) {
            return { code: 1, out: '', err: 'Usage: folders [list]\n' }
        }
        if (sub && sub !== 'list') {
            return { code: 1, out: '', err: 'Usage: folders [list]\n' }
        }
        try {
            const v = host.getVault()
            if (!v.isLoggedIn) {
                const r = await ensureLoggedIn(host)
                if (r.code !== 0) return r
            }
            await v.sync()
            const folders = v.getSharedFolders()
            const rows = folders.map((f: DSharedFolder) => {
                const name = f.name ?? '(unnamed)'
                const uid = f.uid ?? '(unknown uid)'
                return `${uid}\t${name}`
            })
            const header = 'shared_folder_uid\tname\n'
            const body = rows.length ? rows.join('\n') + '\n' : '(no shared folders)\n'
            return { code: 0, out: header + body, err: '' }
        } catch (e) {
            return { code: 1, out: '', err: host.formatError('folders', e) }
        }
    },
}
