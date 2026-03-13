import type { GraphDelta, GraphSchema } from "../../types/graph-delta.js";

export interface NeighborsOptions {
  edgeTypes?: string[];
  limit?: number;
  cursor?: string;
}

export interface ExpandOptions {
  depth?: number;
  limit?: number;
}

export interface QueryOptions {
  params?: Record<string, unknown>;
  limit?: number;
  cursor?: string;
}

/**
 * Base adapter interface: translates MCP tool calls into GraphDelta.
 * Each provider (Spanner, Neo4j, etc.) implements this.
 */
export interface BaseAdapter {
  readonly providerName: string;

  getSchema(dataset: string): Promise<GraphDelta>;
  getGraphSchema(dataset: string): Promise<GraphSchema>;
  getNeighbors(
    dataset: string,
    nodeId: string,
    opts: NeighborsOptions
  ): Promise<GraphDelta>;
  expand(
    dataset: string,
    nodeIds: string[],
    opts: ExpandOptions
  ): Promise<GraphDelta>;
  query(
    dataset: string,
    query: string,
    opts: QueryOptions
  ): Promise<GraphDelta>;
}
