// ---------------------------------------------------------------------------
// MCP Server — Exposes the gateway's graph operations as MCP tools.
// This allows AI tools (Claude Desktop, OpenCode, Cursor, etc.) to use
// the gateway directly via stdio transport.
// ---------------------------------------------------------------------------

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { MCPManager } from "./mcp-manager.js";
import type { GraphDelta, GraphSchema } from "../types/graph-delta.js";
import { logger } from "../utils/logger.js";

/**
 * Create an MCP server that wraps the gateway's provider registry.
 * Exposes tools: list_providers, get_schema, query_graph, get_neighbors
 */
export function createMCPServer(mcpManager: MCPManager): McpServer {
  const server = new McpServer({
    name: "graphxr-gateway",
    version: "0.1.0",
  });

  // -------------------------------------------------------------------------
  // Tool: list_providers
  // -------------------------------------------------------------------------
  server.tool(
    "list_providers",
    "List all configured graph database providers with their status, database type, and available datasets.",
    {},
    async () => {
      const providers = mcpManager.registry.listProviders();
      const result = providers.map((p) => ({
        name: p.name,
        databaseType: p.databaseType,
        transport: p.transport,
        status: p.status,
        datasets: p.datasets,
        tools: mcpManager.getProviderTools(p.name) ?? [],
      }));
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  // -------------------------------------------------------------------------
  // Tool: get_schema
  // -------------------------------------------------------------------------
  server.tool(
    "get_schema",
    "Get the graph schema (node categories and relationship types) for a provider. Returns category names, property types, and relationship definitions.",
    {
      provider: z.string().describe("Provider name (from list_providers)"),
      dataset: z.string().optional().describe("Dataset name (defaults to first dataset)"),
    },
    async ({ provider, dataset }) => {
      const adapter = mcpManager.registry.getAdapter(provider);
      if (!adapter) {
        return {
          content: [{ type: "text" as const, text: `Error: Provider "${provider}" not found. Use list_providers to see available providers.` }],
          isError: true,
        };
      }

      const ds = dataset ?? mcpManager.registry.listDatasets(provider)?.[0];
      if (!ds) {
        return {
          content: [{ type: "text" as const, text: `Error: No dataset specified and provider has no datasets configured.` }],
          isError: true,
        };
      }

      try {
        const schema: GraphSchema = await adapter.getGraphSchema(ds);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(schema, null, 2) }],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Error getting schema: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // -------------------------------------------------------------------------
  // Tool: query_graph
  // -------------------------------------------------------------------------
  server.tool(
    "query_graph",
    "Execute a graph database query (Cypher for Neo4j/Memgraph, GQL for Spanner, SQL for others). Returns nodes and edges in a unified format.",
    {
      provider: z.string().describe("Provider name (from list_providers)"),
      query: z.string().describe("Query string (e.g. Cypher: 'MATCH (n) RETURN n LIMIT 10')"),
      dataset: z.string().optional().describe("Dataset name (defaults to first dataset)"),
      parameters: z.record(z.unknown()).optional().describe("Query parameters (key-value pairs)"),
      limit: z.number().optional().describe("Max results to return"),
    },
    async ({ provider, query, dataset, parameters, limit }) => {
      const adapter = mcpManager.registry.getAdapter(provider);
      if (!adapter) {
        return {
          content: [{ type: "text" as const, text: `Error: Provider "${provider}" not found. Use list_providers to see available providers.` }],
          isError: true,
        };
      }

      const ds = dataset ?? mcpManager.registry.listDatasets(provider)?.[0];
      if (!ds) {
        return {
          content: [{ type: "text" as const, text: `Error: No dataset specified and provider has no datasets configured.` }],
          isError: true,
        };
      }

      try {
        logger.audit("mcp_server:query", { provider, dataset: ds, query });
        const result: GraphDelta = await adapter.query(ds, query, {
          params: parameters,
          limit,
        });

        const summary = {
          nodeCount: result.nodes.length,
          edgeCount: result.edges.length,
          nodes: result.nodes,
          edges: result.edges,
        };
        return {
          content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Error executing query: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // -------------------------------------------------------------------------
  // Tool: get_neighbors
  // -------------------------------------------------------------------------
  server.tool(
    "get_neighbors",
    "Get neighbor nodes and edges connected to a specific node. Useful for graph exploration and traversal.",
    {
      provider: z.string().describe("Provider name"),
      nodeId: z.string().describe("ID of the node to get neighbors for"),
      dataset: z.string().optional().describe("Dataset name (defaults to first dataset)"),
      edgeTypes: z.array(z.string()).optional().describe("Filter by edge/relationship types"),
      limit: z.number().optional().describe("Max neighbors to return"),
    },
    async ({ provider, nodeId, dataset, edgeTypes, limit }) => {
      const adapter = mcpManager.registry.getAdapter(provider);
      if (!adapter) {
        return {
          content: [{ type: "text" as const, text: `Error: Provider "${provider}" not found.` }],
          isError: true,
        };
      }

      const ds = dataset ?? mcpManager.registry.listDatasets(provider)?.[0];
      if (!ds) {
        return {
          content: [{ type: "text" as const, text: `Error: No dataset specified.` }],
          isError: true,
        };
      }

      try {
        const result: GraphDelta = await adapter.getNeighbors(ds, nodeId, {
          edgeTypes,
          limit,
        });
        const summary = {
          nodeCount: result.nodes.length,
          edgeCount: result.edges.length,
          nodes: result.nodes,
          edges: result.edges,
        };
        return {
          content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Error getting neighbors: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  return server;
}
