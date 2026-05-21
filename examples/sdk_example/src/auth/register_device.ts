import {
    KeeperVault,
    KeeperSdkError,
    prompt,
    suppressLogs,
    cleanup,
    logger,
    SdkDefaults,
    ResultCodes,
} from '@keeper-security/keeper-sdk-javascript'
import { runExample } from '../utils/runner'

/**
 * Store device token + device private key on a KeeperVault (in-memory for this process).
 * Use before loginWithSessionToken when ~/.keeper/config.json has no device yet.
 */
async function main() {
    const username = await prompt('Username (email): ')
    if (!username) throw new KeeperSdkError('Username is required.', ResultCodes.MISSING_USERNAME)

    const host = (await prompt('Host [keepersecurity.com]: ')).trim() || 'keepersecurity.com'
    const deviceToken = await prompt('Device token (base64 / base64url): ')
    if (!deviceToken.trim()) {
        throw new KeeperSdkError('Device token is required.', ResultCodes.INVALID_CREDENTIALS)
    }
    const privateKey = await prompt('Device private key (base64 / base64url): ')
    if (!privateKey.trim()) {
        throw new KeeperSdkError('Device private key is required.', ResultCodes.INVALID_CREDENTIALS)
    }

    const vault = new KeeperVault({ host, clientVersion: SdkDefaults.CLIENT_VERSION })

    try {
        await vault.registerDevice(deviceToken.trim(), privateKey.trim(), { username })
        logger.info(`Device credentials stored in memory for ${host} (this Node process).`)
        logger.info('They are not written to ~/.keeper/config.json unless you use a full password login.\n')

        const tryLogin = (await prompt('Login with session token now? [y/N]: ')).trim().toLowerCase()
        if (tryLogin !== 'y' && tryLogin !== 'yes') {
            logger.info('Done. Call loginWithSessionToken on the same vault instance, or run auth:session-token.')
            return
        }

        const sessionToken = await prompt('Session token: ')
        if (!sessionToken.trim()) {
            throw new KeeperSdkError('Session token is required.', 'missing_session_token')
        }

        logger.info(`\nLogging in as ${username} on ${host}...`)
        const restore = suppressLogs()
        try {
            await vault.loginWithSessionToken(username, sessionToken.trim())
        } finally {
            restore()
        }

        logger.info('Syncing vault...')
        const restoreSync = suppressLogs()
        try {
            await vault.sync()
        } finally {
            restoreSync()
        }

        const summary = vault.getSummary()
        const auth = vault.getAuth()
        logger.info('--- Session Info ---')
        logger.info(`  Username:  ${auth.username}`)
        logger.info(`  Records:   ${summary.recordCount}`)
        logger.info('\nLogin + sync successful.')
    } finally {
        cleanup(vault)
    }
}

runExample(main)
