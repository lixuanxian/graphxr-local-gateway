// ---------------------------------------------------------------------------
// GraphDelta — Unified graph response format
// Compatible with graphxr-database-proxy API format
// ---------------------------------------------------------------------------

/**
 * Graph node — matches graphxr-database-proxy Node format.
 * - `id`: unique identifier (may be base64-encoded compound key)
 * - `labels`: category/type list (e.g. ["Person"], ["Person","Employee"])
 * - `properties`: arbitrary key-value attributes
 */
export interface GNode {
  id: string;
  labels: string[];
  properties: Record<string, unknown>;
}

/**
 * Graph edge/relationship — matches graphxr-database-proxy Edge format.
 * - `id`: unique edge identifier
 * - `type`: relationship name (e.g. "WORKS_AT", "KNOWS")
 * - `startNodeId` / `endNodeId`: source and target node IDs
 * - `properties`: arbitrary key-value attributes
 */
export interface GEdge {
  id: string;
  type: string;
  startNodeId: string;
  endNodeId: string;
  properties: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Graph schema types — describes the shape of nodes/edges in a graph
// ---------------------------------------------------------------------------

export type SpannerType =
  | "STRING"
  | "INT64"
  | "FLOAT64"
  | "BOOL"
  | "BYTES"
  | "DATE"
  | "TIMESTAMP"
  | "JSON"
  | "ARRAY"
  | string;

export interface CategorySchema {
  name: string;
  props: string[];
  keys: string[];
  keysTypes: Record<string, SpannerType>;
  propsTypes: Record<string, SpannerType>;
}

export interface RelationshipSchema {
  name: string;
  props: string[];
  keys: string[];
  keysTypes: Record<string, SpannerType>;
  propsTypes: Record<string, SpannerType>;
  startCategory: string;
  endCategory: string;
}

export interface GraphSchema {
  categories: CategorySchema[];
  relationships: RelationshipSchema[];
}

// ---------------------------------------------------------------------------
// Pagination, summary, provenance
// ---------------------------------------------------------------------------

export interface PageInfo {
  cursor?: string;
  hasMore: boolean;
}

export interface Summary {
  truncated: boolean;
  reason?: string;
  counts?: { nodes: number; edges: number };
}

export interface Provenance {
  provider: string;
  dataset: string;
  operation: string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// GraphDelta — the envelope returned by all graph operations
// ---------------------------------------------------------------------------

export interface GraphDelta {
  nodes: GNode[];
  edges: GEdge[];
  pageInfo?: PageInfo;
  summary?: Summary;
  provenance: Provenance;
}

// ---------------------------------------------------------------------------
// QueryResponse — wrapper matching graphxr-database-proxy response envelope
// ---------------------------------------------------------------------------

export interface QueryResponse<T = GraphDelta> {
  success: boolean;
  data?: T;
  error?: string;
  execution_time?: number;
}

// ---------------------------------------------------------------------------
// Database type enum
// ---------------------------------------------------------------------------

export type DatabaseType =
  | "neo4j"
  | "spanner"
  | "postgresql"
  | "mysql"
  | "mongodb"
  | "neptune"
  | "tigergraph"
  | "memgraph"
  | "generic";
