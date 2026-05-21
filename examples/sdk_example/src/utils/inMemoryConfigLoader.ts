import type { ConfigLoader, KeeperJsonConfig } from '@keeper-security/keeper-sdk-javascript'

/** In-memory session/device storage (same role as shellcomponent's InMemoryConfigLoader). */
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
