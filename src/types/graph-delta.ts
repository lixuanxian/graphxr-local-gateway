export interface GNode {
  id: string;
  type: string;
  props: Record<string, unknown>;
}

export interface GEdge {
  id: string;
  src: string;
  dst: string;
  type: string;
  props: Record<string, unknown>;
}

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
  tool: string;
  timestamp: string;
}

export interface GraphDelta {
  nodes: GNode[];
  edges: GEdge[];
  pageInfo?: PageInfo;
  summary?: Summary;
  provenance: Provenance;
}
