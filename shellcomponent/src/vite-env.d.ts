/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Must match the username you use with `login` (device lookup is keyed by last_login/user). */
  readonly VITE_KEEPER_DEV_DEVICE_USER?: string;
  /** Base64url device token from `.keeper/config.json` (same as `device_token`). */
  readonly VITE_KEEPER_DEV_DEVICE_TOKEN?: string;
  /** Base64url EC private key from `.keeper/config.json` (same as `private_key`). */
  readonly VITE_KEEPER_DEV_DEVICE_PRIVATE_KEY?: string;
}
