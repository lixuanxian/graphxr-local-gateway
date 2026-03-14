import fs from "node:fs/promises";
import type { GatewayConfig, ProviderConfig } from "../types/config.js";

export class ConfigManager {
  private config: GatewayConfig;

  constructor(
    private readonly configPath: string,
    initial: GatewayConfig
  ) {
    this.config = { ...initial };
  }

  get(): GatewayConfig {
    return this.config;
  }

  async update(
    changes: Partial<Pick<GatewayConfig, "allowedOrigins" | "tokenTTL" | "pairingTimeout" | "authEnabled">>
  ): Promise<GatewayConfig> {
    if (changes.tokenTTL !== undefined && changes.tokenTTL <= 0) {
      throw new Error("tokenTTL must be positive");
    }
    if (changes.pairingTimeout !== undefined && changes.pairingTimeout <= 0) {
      throw new Error("pairingTimeout must be positive");
    }
    if (changes.allowedOrigins !== undefined && !Array.isArray(changes.allowedOrigins)) {
      throw new Error("allowedOrigins must be an array");
    }

    Object.assign(this.config, changes);
    await this.persist();
    return this.config;
  }

  async updateProviders(providers: ProviderConfig[]): Promise<void> {
    this.config.providers = providers;
    await this.persist();
  }

  private async persist(): Promise<void> {
    await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2) + "\n", "utf-8");
  }
}
