import type { CliCommandDefinition, KeeperCliHost } from '../types'
import { getOpt, rejectUnknownOptions, wantsCliHelp } from '../parse'
import { formatDetailedHelpForCommand } from '../help'

const REGISTER_DEVICE_ALLOWED = new Set(['device-token', 'dt', 'private-key', 'pk', 'username', 'user'])

export const registerDeviceCommand: CliCommandDefinition = {
    name: 'register-device',
    order: 15,
    description:
        'Store device token + private key in this shell’s session so session-token login works (see login --help).',
    usage:
        'register-device --device-token|--dt <b64> --private-key|--pk <b64> [--username <u>] [--help|-h]',
    flagOptions: [
        '--device-token',
        '--dt',
        '--private-key',
        '--pk',
        '--user',
        '--username',
    ],
    allowedOptions: REGISTER_DEVICE_ALLOWED,
    help: {
        title: 'register-device — store device token and private key for session-token login',
        synopsis:
            '  register-device --device-token|--dt B64 --private-key|--pk B64 [--username|--user U]',
        description: `  Calls KeeperVault.registerDevice to save device credentials for the current
  host in this shell’s in-memory session. After this, you can run:

    login --username YOU --session-token TOKEN

  without a prior password login in this shell, as long as the token is valid.

  Obtain device_token and private_key from another machine’s keeper config after
  a successful login, or from your integration that provisions device keys.
  Values accept base64 or base64url (same decoding as SessionManager / normal64Bytes).`,
        options: `  --device-token, --dt     Device token string.
  --private-key, --pk      Device private key string.
  --username, --user       Optional; sets last username in session storage (recommended).`,
        environment: `  REGISTER_DEVICE_TOKEN       Same as --device-token when flag omitted.
  REGISTER_DEVICE_PRIVATE_KEY Same as --private-key when flag omitted.
  KEEPER_HOST                 Same as other keeper commands.`,
        keeperSdk: '  KeeperVault.registerDevice(deviceToken, privateKey, { username? })',
        appendVaultSurface: true,
    },
    async run(host, parsed) {
        if (wantsCliHelp(parsed)) {
            return { code: 0, out: formatDetailedHelpForCommand(registerDeviceCommand), err: '' }
        }
        const bad = rejectUnknownOptions(parsed, REGISTER_DEVICE_ALLOWED, 'register-device')
        if (bad) return bad
        if (parsed.positional.length > 0) {
            return {
                code: 1,
                out: '',
                err: 'register-device: unexpected positional arguments\n',
            }
        }

        const deviceToken =
            getOpt(parsed.opts, 'device-token', 'dt') ?? host.envString('REGISTER_DEVICE_TOKEN')
        const privateKey =
            getOpt(parsed.opts, 'private-key', 'pk') ?? host.envString('REGISTER_DEVICE_PRIVATE_KEY')
        const usernameOpt = getOpt(parsed.opts, 'username', 'user')
        const username = usernameOpt?.trim() || undefined

        const dt = typeof deviceToken === 'string' ? deviceToken.trim() : ''
        const pk = typeof privateKey === 'string' ? privateKey.trim() : ''
        if (!dt || !pk) {
            return {
                code: 1,
                out: '',
                err:
                    'register-device: --device-token and --private-key required ' +
                    '(or REGISTER_DEVICE_TOKEN / REGISTER_DEVICE_PRIVATE_KEY env).\n',
            }
        }

        try {
            const v = host.getVault()
            await v.registerDevice(dt, pk, username ? { username } : undefined)
            const umsg = username ? ` Last username set to ${username}.` : ''
            return {
                code: 0,
                out: `keeper: device credentials stored in this shell’s session.${umsg} Next: login --username … --session-token …\n`,
                err: '',
            }
        } catch (e) {
            return { code: 1, out: '', err: host.formatError('register-device', e) }
        }
    },
}
