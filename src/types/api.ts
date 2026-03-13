import type { DatabaseType } from "./graph-delta.js";

// --- Pairing ---

export interface PairStartRequest {
  origin: string;
  app?: string;
  scopes?: string[];
}

export interface PairStartResponse {
  pairingId: string;
  confirmUrl: string;
}

export interface PairStatusResponse {
  status: "pending" | "approved" | "denied";
  token?: string;
  expiresAt?: string;
}

// --- Catalog ---

export interface CatalogProvider {
  name: string;
  transport: string;
  databaseType: DatabaseType;
  datasets: string[];
  status: "connected" | "disconnected" | "error";
}

// --- Graph operations (gateway-specific body format) ---

export interface GraphSchemaRequest {
  provider: string;
  dataset: string;
}

export interface GraphNeighborsRequest {
  provider: string;
  dataset: string;
  nodeId: string;
  edgeTypes?: string[];
  limit?: number;
  cursor?: string;
}

export interface GraphExpandRequest {
  provider: string;
  dataset: string;
  nodeIds: string[];
  depth?: number;
  limit?: number;
}

export interface GraphQueryRequest {
  provider: string;
  dataset: string;
  query: string;
  params?: Record<string, unknown>;
  limit?: number;
  cursor?: string;
}

// --- Proxy-compatible API (matches graphxr-database-proxy) ---

export interface ProxyQueryRequest {
  query: string;
  parameters?: Record<string, unknown>;
}

export interface ProxyApiInfoResponse {
  databaseType: DatabaseType;
  urls: {
    info: string;
    query: string;
    graphSchema: string;
    schema: string;
  };
}

// --- Health ---

export interface HealthResponse {
  status: "ok";
  version: string;
  providers: Array<{ name: string; status: string; databaseType: DatabaseType }>;
}
