import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { ProviderConfig } from "../types/config.js";
import { ProviderRegistry } from "./provider-registry.js";
import { MCPAdapter } from "./adapters/mcp-adapter.js";
import { MockAdapter } from "./adapters/mock-adapter.js";
import { logger } from "../utils/logger.js";

interface ManagedProvider {
  config: ProviderConfig;
  client?: Client;
  transport?: StdioClientTransport;
}

/**
 * Manages MCP server connections and provider lifecycle.
 * Spawns child processes for stdio transport, maintains connections.
 */
export class MCPManager {
  private managed = new Map<string, ManagedProvider>();
  readonly registry = new ProviderRegistry();

  /**
   * Initialize all providers from config.
   * If no providers are configured, registers a mock adapter.
   */
  async init(providers: ProviderConfig[]): Promise<void> {
    if (providers.length === 0) {
      logger.info("No providers configured — registering mock adapter");
      this.registry.register(
        { name: "mock", transport: "stdio", databaseType: "generic", datasets: ["demo"], args: [] },
        new MockAdapter()
      );
      return;
    }

    for (const config of providers) {
      try {
        await this.connectProvider(config);
      } catch (err) {
        logger.error(`Failed to connect provider "${config.name}":`, err);
        this.managed.set(config.name, { config });
        this.registry.setStatus(config.name, "error");
      }
    }
  }

  /**
   * Add and connect a provider at runtime.
   */
  async addProvider(config: ProviderConfig): Promise<void> {
    // Remove mock adapter if it's the only one
    const providers = this.registry.listProviders();
    if (providers.length === 1 && providers[0].name === "mock") {
      const adapter = this.registry.getAdapter("mock");
      if (adapter instanceof MockAdapter) {
        this.registry.unregister("mock");
        logger.info("Removed mock adapter (real provider being added)");
      }
    }

    await this.connectProvider(config);
  }

  /**
   * Remove and disconnect a provider at runtime.
   */
  async removeProvider(name: string): Promise<void> {
    const managed = this.managed.get(name);
    if (managed?.client) {
      try {
        await managed.client.close();
      } catch (err) {
        logger.error(`Error disconnecting "${name}":`, err);
      }
    }
    this.managed.delete(name);
    this.registry.unregister(name);
    logger.info(`Provider "${name}" removed`);
  }

  /**
   * Restart a provider (disconnect + reconnect with stored config).
   */
  async restartProvider(name: string): Promise<void> {
    const managed = this.managed.get(name);
    const config = managed?.config;
    if (!config) {
      throw new Error(`Provider "${name}" not found`);
    }
    await this.removeProvider(name);
    await this.connectProvider(config);
  }

  /**
   * Get the stored config for a managed provider.
   */
  getProviderConfig(name: string): ProviderConfig | undefined {
    return this.managed.get(name)?.config;
  }

  private async connectProvider(config: ProviderConfig): Promise<void> {
    if (config.transport === "stdio") {
      await this.connectStdio(config);
    } else {
      logger.warn(
        `Transport "${config.transport}" for "${config.name}" not yet supported — registering with error status`
      );
      this.managed.set(config.name, { config });
      this.registry.register(config, null as any);
      this.registry.setStatus(config.name, "error");
    }
  }

  private async connectStdio(config: ProviderConfig): Promise<void> {
    if (!config.command) {
      throw new Error(`Provider "${config.name}" (stdio) requires a "command" field`);
    }

    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args ?? [],
      env: { ...process.env, ...(config.env ?? {}) } as Record<string, string>,
    });

    const client = new Client({
      name: `gateway-${config.name}`,
      version: "0.1.0",
    });

    await client.connect(transport);

    // Verify connection by listing tools
    const tools = await client.listTools();
    logger.info(
      `Provider "${config.name}" connected — ${tools.tools.length} tools available`
    );

    const adapter = new MCPAdapter(
      config.name,
      client,
      config.databaseType ?? "generic",
      config.toolMapping
    );

    this.managed.set(config.name, { config, client, transport });
    this.registry.register(config, adapter);
  }

  /**
   * Gracefully shut down all MCP connections.
   */
  async shutdown(): Promise<void> {
    for (const [name, managed] of this.managed) {
      try {
        if (managed.client) {
          await managed.client.close();
        }
        logger.info(`Provider "${name}" disconnected`);
      } catch (err) {
        logger.error(`Error disconnecting "${name}":`, err);
      }
    }
    this.managed.clear();
  }
}
