import { cleanup, logger } from '@keeper-security/keeper-sdk-javascript'
import { runExample } from '../utils/runner'
import { assertRestoreCliArgs, parseRestoreCliArgs, requireSessionJsonPath } from '../utils/restoreAuth'
import { listRecordsViaShellCli, loginViaShellCliRestoreSession } from '../utils/shellCliRestore'

// npm run records:list:shell-cli -- --from-json /path/to/session.json [--host keepersecurity.eu]
async function main() {
    const cli = parseRestoreCliArgs()
    if (!cli.restoreSession && !cli.jsonPath) {
        throw new Error(
            'records:list:shell-cli requires --from-json /path/to/session.json (shell-style restore-session flow)'
        )
    }
    assertRestoreCliArgs({ ...cli, restoreSession: true })

    const jsonPath = requireSessionJsonPath(cli.jsonPath, 'records:list:shell-cli')
    const vault = await loginViaShellCliRestoreSession({
        jsonPath,
        host: cli.host,
        sync: !cli.noSync,
    })

    try {
        const out = await listRecordsViaShellCli()
        logger.info(out.trimEnd())
    } finally {
        cleanup(vault)
    }
}

runExample(main)
