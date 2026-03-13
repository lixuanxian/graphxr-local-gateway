import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type {
  GraphDelta,
  GraphSchema,
  GNode,
  GEdge,
  CategorySchema,
  RelationshipSchema,
  DatabaseType,
} from "../../types/graph-delta.js";
import type { MCPToolMapping } from "../../types/config.js";
import type {
  BaseAdapter,
  NeighborsOptions,
  ExpandOptions,
  QueryOptions,
} from "./base-adapter.js";
import { logger } from "../../utils/logger.js";

// Default tool name mappings per database type
const TOOL_DEFAULTS: Record<string, MCPToolMapping> = {
  neo4j: {
    schema: "get_schema",
    neighbors: "get_neighbors",
    expand: "get_neighbors",
    query: "run_cypher_query",
  },
  spanner: {
    schema: "get_schema",
    neighbors: "get_neighbors",
    expand: "get_neighbors",
    query: "execute_query",
  },
  generic: {
    schema: "get_schema",
    neighbors: "get_neighbors",
    expand: "get_neighbors",
    query: "run_query",
  },
};

/**
 * Generic MCP adapter — calls MCP tools on a downstream server
 * and converts results to GraphDelta (graphxr-database-proxy compatible).
 *
 * Supports database-type-aware normalization of node/edge formats.
 */
export class MCPAdapter implements BaseAdapter {
  readonly providerName: string;
  private client: Client;
  private toolMapping: Required<MCPToolMapping>;
  private databaseType: DatabaseType;

  constructor(
    providerName: string,
    client: Client,
    databaseType: DatabaseType = "generic",
    toolMapping?: Partial<MCPToolMapping>
  ) {
    this.providerName = providerName;
    this.client = client;
    this.databaseType = databaseType;

    const defaults = TOOL_DEFAULTS[databaseType] ?? TOOL_DEFAULTS.generic;
    this.toolMapping = {
      schema: toolMapping?.schema ?? defaults.schema ?? "get_schema",
      neighbors:
        toolMapping?.neighbors ?? defaults.neighbors ?? "get_neighbors",
      expand: toolMapping?.expand ?? defaults.expand ?? "get_neighbors",
      query: toolMapping?.query ?? defaults.query ?? "run_query",
    };
  }

  async getSchema(dataset: string): Promise<GraphDelta> {
    const result = await this.callTool(this.toolMapping.schema, { dataset });
    return this.toGraphDelta(result, dataset, "schema");
  }

  async getGraphSchema(dataset: string): Promise<GraphSchema> {
    const result = await this.callTool(this.toolMapping.schema, { dataset });
    return this.toGraphSchema(result);
  }

  async getNeighbors(
    dataset: string,
    nodeId: string,
    opts: NeighborsOptions
  ): Promise<GraphDelta> {
    // If no dedicated neighbors tool, use query tool with generated query
    if (this.shouldUseQueryFallback("neighbors")) {
      const q = this.generateNeighborsQuery(nodeId, opts);
      return this.query(dataset, q, { limit: opts.limit ?? 50 });
    }

    const result = await this.callTool(this.toolMapping.neighbors, {
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
    // If no dedicated expand tool, use query tool with generated query
    if (this.shouldUseQueryFallback("expand")) {
      const q = this.generateExpandQuery(nodeIds, opts);
      return this.query(dataset, q, { limit: opts.limit ?? 100 });
    }

    const result = await this.callTool(this.toolMapping.expand, {
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
    const result = await this.callTool(this.toolMapping.query, {
      dataset,
      query,
      params: opts.params,
      limit: opts.limit ?? 100,
      cursor: opts.cursor,
    });
    return this.toGraphDelta(result, dataset, "query");
  }

  // -----------------------------------------------------------------------
  // MCP tool invocation
  // -----------------------------------------------------------------------

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

  // -----------------------------------------------------------------------
  // Normalization: raw MCP result → GraphDelta
  // -----------------------------------------------------------------------

  private toGraphDelta(
    raw: unknown,
    dataset: string,
    operation: string
  ): GraphDelta {
    const data = raw as any;
    const nodes: GNode[] = [];
    const edges: GEdge[] = [];

    // Extract nodes from various shapes
    const rawNodes: any[] =
      data?.nodes ?? data?.data?.nodes ?? data?.results?.nodes ?? [];
    for (const n of rawNodes) {
      nodes.push(this.normalizeNode(n));
    }

    // Extract edges from various shapes
    const rawEdges: any[] =
      data?.edges ??
      data?.relationships ??
      data?.data?.edges ??
      data?.data?.relationships ??
      data?.results?.edges ??
      data?.results?.relationships ??
      [];
    for (const e of rawEdges) {
      edges.push(this.normalizeEdge(e));
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
        operation,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Normalize a raw node object to GNode format.
   * Handles multiple conventions: Neo4j (labels), Spanner (label), generic (type).
   */
  private normalizeNode(n: any): GNode {
    const id = String(n.id ?? n.nodeId ?? n.identity ?? n.name ?? "");

    // Labels: could be an array, a single string, or a "type" field
    let labels: string[];
    if (Array.isArray(n.labels)) {
      labels = n.labels.map(String);
    } else if (n.label) {
      labels = [String(n.label)];
    } else if (n.type) {
      labels = [String(n.type)];
    } else if (n.kind) {
      labels = [String(n.kind)];
    } else {
      labels = ["Unknown"];
    }

    // Properties: could be nested or at top level
    const properties: Record<string, unknown> =
      n.properties ?? n.props ?? n.data ?? {};

    return { id, labels, properties };
  }

  /**
   * Normalize a raw edge object to GEdge format.
   * Handles Neo4j (startNodeId/endNodeId), generic (src/dst, from/to, source/target).
   */
  private normalizeEdge(e: any): GEdge {
    const id = String(
      e.id ??
        e.edgeId ??
        e.identity ??
        `${e.startNodeId ?? e.src ?? e.source ?? e.from}-${e.endNodeId ?? e.dst ?? e.target ?? e.to}`
    );

    const startNodeId = String(
      e.startNodeId ?? e.src ?? e.source ?? e.startNode ?? e.from ?? ""
    );
    const endNodeId = String(
      e.endNodeId ?? e.dst ?? e.target ?? e.endNode ?? e.to ?? ""
    );

    const type = String(
      e.type ?? e.label ?? e.relationshipType ?? e.relationship ?? "RELATED"
    );

    const properties: Record<string, unknown> =
      e.properties ?? e.props ?? e.data ?? {};

    return { id, type, startNodeId, endNodeId, properties };
  }

  // -----------------------------------------------------------------------
  // Normalization: raw MCP result → GraphSchema
  // -----------------------------------------------------------------------

  private toGraphSchema(raw: unknown): GraphSchema {
    const data = raw as any;
    const categories: CategorySchema[] = [];
    const relationships: RelationshipSchema[] = [];

    // Extract categories from various shapes
    const rawCategories: any[] =
      data?.categories ??
      data?.nodeTypes ??
      data?.node_types ??
      data?.labels ??
      [];
    for (const c of rawCategories) {
      categories.push({
        name: String(c.name ?? c.label ?? c.type ?? "Unknown"),
        props: Array.isArray(c.props) ? c.props : Object.keys(c.propsTypes ?? c.properties ?? {}),
        keys: Array.isArray(c.keys) ? c.keys : [],
        keysTypes: c.keysTypes ?? {},
        propsTypes: c.propsTypes ?? c.propertyTypes ?? {},
      });
    }

    // Extract relationships from various shapes
    const rawRels: any[] =
      data?.relationships ??
      data?.edgeTypes ??
      data?.edge_types ??
      data?.relationshipTypes ??
      [];
    for (const r of rawRels) {
      relationships.push({
        name: String(r.name ?? r.type ?? r.label ?? "RELATED"),
        props: Array.isArray(r.props) ? r.props : Object.keys(r.propsTypes ?? r.properties ?? {}),
        keys: Array.isArray(r.keys) ? r.keys : [],
        keysTypes: r.keysTypes ?? {},
        propsTypes: r.propsTypes ?? r.propertyTypes ?? {},
        startCategory: String(r.startCategory ?? r.source ?? r.from ?? ""),
        endCategory: String(r.endCategory ?? r.target ?? r.to ?? ""),
      });
    }

    return { categories, relationships };
  }

  // -----------------------------------------------------------------------
  // Query fallback: generate database-specific queries for neighbors/expand
  // -----------------------------------------------------------------------

  /**
   * Check if we should fall back to using the query tool for an operation.
   * This happens when the tool mapping for the operation is the same as
   * the query tool (meaning no dedicated tool was found).
   */
  private shouldUseQueryFallback(operation: "neighbors" | "expand"): boolean {
    const mapped = this.toolMapping[operation];
    // If the tool is the same as the query tool, there's no dedicated tool
    return mapped === this.toolMapping.query;
  }

  /**
   * Generate a query to find neighbors of a node.
   * Uses Cypher for Neo4j, GQL for Spanner, generic Cypher otherwise.
   */
  private generateNeighborsQuery(nodeId: string, opts: NeighborsOptions): string {
    const limit = opts.limit ?? 50;
    const safeId = escapeQueryParam(nodeId);

    switch (this.databaseType) {
      case "neo4j":
      case "memgraph": {
        // Cypher query
        const edgeFilter = opts.edgeTypes?.length
          ? `:${opts.edgeTypes.join("|")}`
          : "";
        return `MATCH (n)-[r${edgeFilter}]-(m) WHERE n.id = '${safeId}' OR id(n) = ${isNumeric(nodeId) ? nodeId : `'${safeId}'`} RETURN n, r, m LIMIT ${limit}`;
      }
      case "spanner": {
        // GQL (Spanner Graph)
        return `MATCH (n)-[r]-(m) WHERE n.id = '${safeId}' RETURN n, r, m LIMIT ${limit}`;
      }
      default: {
        // Generic Cypher-like
        return `MATCH (n)-[r]-(m) WHERE n.id = '${safeId}' RETURN n, r, m LIMIT ${limit}`;
      }
    }
  }

  /**
   * Generate a query to expand from multiple nodes.
   * Uses Cypher for Neo4j, GQL for Spanner.
   */
  private generateExpandQuery(nodeIds: string[], opts: ExpandOptions): string {
    const limit = opts.limit ?? 100;
    const depth = opts.depth ?? 1;
    const safeIds = nodeIds.map(escapeQueryParam);

    switch (this.databaseType) {
      case "neo4j":
      case "memgraph": {
        const idList = safeIds.map((id) => `'${id}'`).join(", ");
        return `MATCH (n)-[r*1..${depth}]-(m) WHERE n.id IN [${idList}] RETURN n, r, m LIMIT ${limit}`;
      }
      case "spanner": {
        const idList = safeIds.map((id) => `'${id}'`).join(", ");
        return `MATCH (n)-[r]->{1,${depth}}(m) WHERE n.id IN [${idList}] RETURN n, r, m LIMIT ${limit}`;
      }
      default: {
        const idList = safeIds.map((id) => `'${id}'`).join(", ");
        return `MATCH (n)-[r*1..${depth}]-(m) WHERE n.id IN [${idList}] RETURN n, r, m LIMIT ${limit}`;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeQueryParam(value: string): string {
  return value.replace(/'/g, "\\'").replace(/\\/g, "\\\\");
}

function isNumeric(value: string): boolean {
  return /^\d+$/.test(value);
}
