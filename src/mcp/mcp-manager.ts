import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { ProviderConfig } from "../types/config.js";
import { ProviderRegistry } from "./provider-registry.js";
import { MCPAdapter } from "./adapters/mcp-adapter.js";
import { MockAdapter } from "./adapters/mock-adapter.js";
import { logger } from "../utils/logger.js";

interface ManagedProvider {
  config: ProviderConfig;
  client?: Client;
  transport?: Transport;
  availableTools?: string[];
}

/**
 * Manages MCP server connections and provider lifecycle.
 * Supports stdio and HTTP/SSE transports.
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
        this.registry.register(config, null as any);
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

  /**
   * Get the list of available MCP tools for a provider.
   */
  getProviderTools(name: string): string[] | undefined {
    return this.managed.get(name)?.availableTools;
  }

  // -----------------------------------------------------------------------
  // Transport connection
  // -----------------------------------------------------------------------

  private async connectProvider(config: ProviderConfig): Promise<void> {
    if (config.transport === "stdio") {
      await this.connectStdio(config);
    } else if (config.transport === "http") {
      await this.connectHTTP(config);
    } else {
      throw new Error(`Unknown transport "${config.transport}" for "${config.name}"`);
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

    await this.finishConnect(config, transport);
  }

  private async connectHTTP(config: ProviderConfig): Promise<void> {
    if (!config.endpoint) {
      throw new Error(`Provider "${config.name}" (http) requires an "endpoint" field`);
    }

    const url = new URL(config.endpoint);
    const headers: Record<string, string> = {};

    // Support auth headers from env config
    if (config.env?.AUTHORIZATION) {
      headers["Authorization"] = config.env.AUTHORIZATION;
    }
    if (config.env?.API_KEY) {
      headers["X-API-Key"] = config.env.API_KEY;
    }

    const transport = new StreamableHTTPClientTransport(url, {
      requestInit: {
        headers,
      },
    });

    await this.finishConnect(config, transport);
  }

  /**
   * Shared logic: connect client, discover tools, create adapter, register.
   */
  private async finishConnect(
    config: ProviderConfig,
    transport: Transport
  ): Promise<void> {
    const client = new Client({
      name: `gateway-${config.name}`,
      version: "0.1.0",
    });

    await client.connect(transport);

    // Discover available tools
    const toolsResult = await client.listTools();
    const toolNames = toolsResult.tools.map((t) => t.name);
    logger.info(
      `Provider "${config.name}" connected via ${config.transport} — ${toolNames.length} tools: [${toolNames.join(", ")}]`
    );

    // Auto-detect tool mapping if not explicitly configured
    const toolMapping = config.toolMapping ?? autoDetectToolMapping(toolNames, config.databaseType);

    const adapter = new MCPAdapter(
      config.name,
      client,
      config.databaseType ?? "generic",
      toolMapping
    );

    this.managed.set(config.name, {
      config,
      client,
      transport,
      availableTools: toolNames,
    });
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

// ---------------------------------------------------------------------------
// Auto-detect tool mapping based on discovered tools and database type
// ---------------------------------------------------------------------------

/**
 * Try to map discovered MCP tools to our standard operations.
 * Supports common naming patterns from known MCP servers.
 */
function autoDetectToolMapping(
  tools: string[],
  databaseType: string
): Record<string, string> {
  const mapping: Record<string, string> = {};
  const toolSet = new Set(tools);

  // Schema tool detection (ordered by preference)
  const schemaCandidates = [
    // Neo4j official MCP server
    "get-schema",
    // Neo4j Labs mcp-neo4j-cypher
    "get_schema",
    // Spanner MCP Toolbox
    "spanner-list-graphs",
    "spanner-list-tables",
    // Generic patterns
    "get_graph_schema",
    "describe_graph",
    "schema",
    "graphSchema",
    "get_node_types",
    "get_neo4j_schema",
    "get_spanner_schema",
  ];
  for (const c of schemaCandidates) {
    if (toolSet.has(c)) {
      mapping.schema = c;
      break;
    }
  }

  // Query tool detection (ordered by preference)
  const queryCandidates = [
    // Neo4j official MCP server
    "read-cypher",
    // Neo4j Labs mcp-neo4j-cypher
    "run_read_query",
    // Spanner MCP Toolbox
    "spanner-sql",
    "spanner-execute-sql",
    // Generic patterns
    "run_query",
    "execute_query",
    "query",
    "run_cypher_query",
    "execute_cypher",
    "cypher_query",
    "read_neo4j_cypher",
    "write_neo4j_cypher",
    "run_gql_query",
    "execute_gql",
    "spanner_query",
  ];
  for (const c of queryCandidates) {
    if (toolSet.has(c)) {
      mapping.query = c;
      break;
    }
  }

  // Neighbors tool detection
  const neighborsCandidates = [
    "get_neighbors",
    "get_node_neighbors",
    "expand_node",
    "neighbors",
    "get_connected_nodes",
  ];
  for (const c of neighborsCandidates) {
    if (toolSet.has(c)) {
      mapping.neighbors = c;
      mapping.expand = c;
      break;
    }
  }

  return mapping;
}
