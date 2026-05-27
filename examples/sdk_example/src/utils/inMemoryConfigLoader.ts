import type { ConfigLoader, KeeperJsonConfig } from '@keeper-security/keeper-sdk-javascript'

/** Process-lifetime session/device storage (no disk). */
export class InMemoryConfigLoader implements ConfigLoader {
    public readonly configDir = ''

    private data: KeeperJsonConfig = {}

    async load(): Promise<KeeperJsonConfig> {
        return JSON.parse(JSON.stringify(this.data)) as KeeperJsonConfig
    }

    async save(config: KeeperJsonConfig): Promise<void> {
        this.data = JSON.parse(JSON.stringify(config)) as KeeperJsonConfig
    }
}
