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
  datasets: string[];
  status: "connected" | "disconnected" | "error";
}

// --- Graph ---

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

// --- Health ---

export interface HealthResponse {
  status: "ok";
  version: string;
  providers: Array<{ name: string; status: string }>;
}
