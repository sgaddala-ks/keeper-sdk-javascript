import type { ConfigLoader, KeeperJsonConfig } from "@keeper-security/keeper-sdk-javascript";

/**
 * When `import.meta.env.DEV` is true and all three Vite env vars are set, preloads the same
 * flat device shape as `~/.keeper/config.json` so {@link SessionManager.getDeviceConfig} returns
 * a token/key before login — keeperapi `loginV3` then skips `registerDevice()`.
 * Use the same username you pass to `login` as `VITE_KEEPER_DEV_DEVICE_USER` (case-insensitive match).
 */
function readDevSeededKeeperConfig(): KeeperJsonConfig {
  if (import.meta.env?.DEV !== true) return {};
  const user = (import.meta.env.VITE_KEEPER_DEV_DEVICE_USER as string | undefined)?.trim();
  const device_token = (import.meta.env.VITE_KEEPER_DEV_DEVICE_TOKEN as string | undefined)?.trim();
  const private_key = (import.meta.env.VITE_KEEPER_DEV_DEVICE_PRIVATE_KEY as string | undefined)?.trim();
  if (!user || !device_token || !private_key) return {};
  return {
    user,
    last_login: user,
    device_token,
    private_key,
  };
}

/**
 * Session/device storage for {@link KeeperVault} inside the browser shell (no `.keeper` on disk).
 */
export class InMemoryConfigLoader implements ConfigLoader {
  public readonly configDir = "";

  private data: KeeperJsonConfig;

  constructor() {
    const seed = readDevSeededKeeperConfig();
    this.data = Object.keys(seed).length > 0 ? seed : {};
  }

  async load(): Promise<KeeperJsonConfig> {
    return JSON.parse(JSON.stringify(this.data)) as KeeperJsonConfig;
  }

  async save(config: KeeperJsonConfig): Promise<void> {
    this.data = JSON.parse(JSON.stringify(config)) as KeeperJsonConfig;
  }
}
