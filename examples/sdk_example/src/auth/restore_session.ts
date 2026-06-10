import { prompt, cleanup, logger } from '@keeper-security/keeper-sdk-javascript'
import { runExample } from '../utils/runner'
import { loginViaRestoreSession, requireSessionJsonPath } from '../utils/restoreAuth'

async function main() {
    const jsonPathInput = await prompt('Session JSON file path (required): ')
    const jsonPath = requireSessionJsonPath(jsonPathInput, 'auth:restore-session')

    const host = (await prompt('Host [keepersecurity.com]: ')).trim() || 'keepersecurity.com'
    const syncAnswer = (await prompt('Run syncDown after restore? [Y/n]: ')).trim().toLowerCase()
    const runSync = syncAnswer !== 'n' && syncAnswer !== 'no'

    const vault = await loginViaRestoreSession({
        jsonPath,
        host,
        sync: runSync,
    })

    try {
        const summary = vault.getSummary()
        logger.info('--- Vault summary ---')
        logger.info(`  Records:        ${summary.recordCount}`)
        logger.info(`  Shared folders: ${summary.sharedFolderCount}`)
        logger.info(`  Teams:          ${summary.teamCount}`)
        logger.info(`  Folders:        ${summary.folderCount}`)
        logger.info('\nRestore complete.')
    } finally {
        cleanup(vault)
    }
}

runExample(main)
