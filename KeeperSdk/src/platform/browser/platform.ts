import type { AuthUI3 } from '@keeper-security/keeperapi'
import { UnavailableAuthUI } from '../../auth/UnavailableAuthUI'
import { KeeperSdkError, ResultCodes } from '../../utils'
import type { ConfigLoader } from '../../auth/config'
import * as asmCrypto from 'asmcrypto.js'
import type { SdkPlatform, SdkReadline } from '../types'

type AsmCryptoModule = typeof asmCrypto & {
    HMAC: { sign: (data: Uint8Array, key: Uint8Array, hash: unknown) => Uint8Array }
    SHA1: unknown
    SHA256: unknown
    SHA512: unknown
}

const asm = asmCrypto as AsmCryptoModule

const HMAC_HASH = {
    sha1: asm.SHA1,
    sha256: asm.SHA256,
    sha512: asm.SHA512,
} as const

const BROWSER_READLINE_MSG =
    'Interactive readline is not available in the browser. Use keeper-shell password transport or a custom authUI.'

const BROWSER_FILE_CONFIG_MSG =
    'File-based Keeper config (~/.keeper) is not available in the browser. Pass an in-memory ConfigLoader to SessionManager or KeeperVault.sessionStorage.'

class BrowserReadline implements SdkReadline {
    question(_prompt: string): Promise<string> {
        return Promise.reject(new KeeperSdkError(BROWSER_READLINE_MSG, ResultCodes.USER_CANCELLED))
    }
    close(): void {
        /* noop */
    }
}

export const browserSdkPlatform: SdkPlatform = {
    runtime: 'browser',

    delay(ms: number): Promise<void> {
        return new Promise((resolve) => globalThis.setTimeout(resolve, ms))
    },

    createReadline(): SdkReadline {
        return new BrowserReadline()
    },

    hmac(algorithm, key, data) {
        const hash = HMAC_HASH[algorithm]
        if (!hash) {
            throw new KeeperSdkError(`Unsupported HMAC algorithm: ${algorithm}`, ResultCodes.UNSUPPORTED_2FA_CHANNEL)
        }
        return asm.HMAC.sign(data, key, hash)
    },

    createFileConfigLoader(): ConfigLoader {
        throw new KeeperSdkError(BROWSER_FILE_CONFIG_MSG, ResultCodes.NOT_LOGGED_IN)
    },

    createAuthUI(useConsoleAuth: boolean): AuthUI3 {
        if (useConsoleAuth) {
            throw new KeeperSdkError(
                'ConsoleAuthUI (readline) is not available in the browser. Set useConsoleAuth: false and provide authUI, or use keeper-shell.',
                ResultCodes.USER_CANCELLED
            )
        }
        return new UnavailableAuthUI()
    },
}
