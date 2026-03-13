import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { GraphDelta, GNode, GEdge } from "../../types/graph-delta.js";
import type {
  BaseAdapter,
  NeighborsOptions,
  ExpandOptions,
  QueryOptions,
} from "./base-adapter.js";
import { logger } from "../../utils/logger.js";

/**
 * Generic MCP adapter — calls MCP tools on a downstream server
 * and converts results to GraphDelta.
 *
 * Tool name mapping is configurable per-provider. Defaults assume
 * the downstream server exposes tools like:
 *   - get_schema / describe_graph
 *   - get_neighbors / expand_node
 *   - run_query / execute_query
 */
export interface MCPToolMapping {
  schema?: string;
  neighbors?: string;
  expand?: string;
  query?: string;
}

const DEFAULT_TOOL_MAPPING: MCPToolMapping = {
  schema: "get_schema",
  neighbors: "get_neighbors",
  expand: "get_neighbors",
  query: "run_query",
};

export class MCPAdapter implements BaseAdapter {
  readonly providerName: string;
  private client: Client;
  private toolMapping: MCPToolMapping;

  constructor(
    providerName: string,
    client: Client,
    toolMapping?: Partial<MCPToolMapping>
  ) {
    this.providerName = providerName;
    this.client = client;
    this.toolMapping = { ...DEFAULT_TOOL_MAPPING, ...toolMapping };
  }

  async getSchema(dataset: string): Promise<GraphDelta> {
    const toolName = this.toolMapping.schema!;
    const result = await this.callTool(toolName, { dataset });
    return this.toGraphDelta(result, dataset, "schema");
  }

  async getNeighbors(
    dataset: string,
    nodeId: string,
    opts: NeighborsOptions
  ): Promise<GraphDelta> {
    const toolName = this.toolMapping.neighbors!;
    const result = await this.callTool(toolName, {
      dataset,
      nodeId,
      edgeTypes: opts.edgeTypes,
      limit: opts.limit ?? 50,
      cursor: opts.cursor,
    });
    return this.toGraphDelta(result, dataset, "neighbors");
  }

  async expand(
    dataset: string,
    nodeIds: string[],
    opts: ExpandOptions
  ): Promise<GraphDelta> {
    const toolName = this.toolMapping.expand!;
    const result = await this.callTool(toolName, {
      dataset,
      nodeIds,
      depth: opts.depth ?? 1,
      limit: opts.limit ?? 100,
    });
    return this.toGraphDelta(result, dataset, "expand");
  }

  async query(
    dataset: string,
    query: string,
    opts: QueryOptions
  ): Promise<GraphDelta> {
    const toolName = this.toolMapping.query!;
    const result = await this.callTool(toolName, {
      dataset,
      query,
      params: opts.params,
      limit: opts.limit ?? 100,
      cursor: opts.cursor,
    });
    return this.toGraphDelta(result, dataset, "query");
  }

  private async callTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    logger.audit("mcp:call_tool", {
      provider: this.providerName,
      tool: toolName,
    });

    const response = await this.client.callTool({
      name: toolName,
      arguments: args,
    });

    // Extract text content from MCP response
    if (response.content && Array.isArray(response.content)) {
      const textContent = response.content.find(
        (c: any) => c.type === "text"
      );
      if (textContent) {
        try {
          return JSON.parse((textContent as any).text);
        } catch {
          return (textContent as any).text;
        }
      }
    }

    return response;
  }

  /**
   * Convert raw MCP tool result to GraphDelta.
   * This is a best-effort converter — real providers may need
   * custom subclasses to handle specific formats.
   */
  private toGraphDelta(
    raw: unknown,
    dataset: string,
    tool: string
  ): GraphDelta {
    const data = raw as any;

    const nodes: GNode[] = [];
    const edges: GEdge[] = [];

    // Try to extract nodes/edges from common shapes
    if (Array.isArray(data?.nodes)) {
      for (const n of data.nodes) {
        nodes.push({
          id: String(n.id ?? n.nodeId ?? n.name),
          type: String(n.type ?? n.label ?? n.labels?.[0] ?? "Unknown"),
          props: n.properties ?? n.props ?? n,
        });
      }
    }

    if (Array.isArray(data?.edges ?? data?.relationships)) {
      for (const e of data.edges ?? data.relationships ?? []) {
        edges.push({
          id: String(e.id ?? e.edgeId ?? `${e.src}-${e.dst}`),
          src: String(e.src ?? e.source ?? e.startNode ?? e.from),
          dst: String(e.dst ?? e.target ?? e.endNode ?? e.to),
          type: String(e.type ?? e.label ?? e.relationshipType ?? "RELATED"),
          props: e.properties ?? e.props ?? {},
        });
      }
    }

    return {
      nodes,
      edges,
      pageInfo: data?.pageInfo ?? { hasMore: false },
      summary: {
        truncated: false,
        counts: { nodes: nodes.length, edges: edges.length },
      },
      provenance: {
        provider: this.providerName,
        dataset,
        tool,
        timestamp: new Date().toISOString(),
      },
    };
  }
}
