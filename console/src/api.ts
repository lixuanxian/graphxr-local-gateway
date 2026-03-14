const BASE = "";

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${url}`, init);
  } catch (err: any) {
    if (err.name === "TypeError") {
      throw new Error("Gateway is unreachable — is the backend running on port 19285?");
    }
    throw err;
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// --- Stats ---
export interface Stats {
  status: string;
  version: string;
  uptime: number;
  uptimeFormatted: string;
  providerCount: number;
  sessionCount: number;
  activeTokenCount: number;
}

export const getStats = () => fetchJSON<Stats>("/api/console/stats");

// --- Providers ---
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

export interface ProviderInfo {
  name: string;
  transport: string;
  databaseType: DatabaseType;
  datasets: string[];
  status: "connected" | "disconnected" | "error";
  tools?: string[];
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  endpoint?: string;
  toolMapping?: Record<string, string>;
}

export interface ProviderConfig {
  name: string;
  transport: string;
  databaseType?: DatabaseType;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  endpoint?: string;
  datasets: string[];
  toolMapping?: Record<string, string>;
}

export const getProviders = () =>
  fetchJSON<{ providers: ProviderInfo[] }>("/api/console/providers").then(
    (r) => r.providers
  );

export const addProvider = (data: ProviderConfig) =>
  fetchJSON<{ status: string; provider: ProviderInfo }>("/api/console/providers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

export const updateProvider = (name: string, data: ProviderConfig) =>
  fetchJSON<{ status: string; provider: ProviderInfo }>(
    `/api/console/providers/${encodeURIComponent(name)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }
  );

export const deleteProvider = (name: string) =>
  fetchJSON<{ status: string }>(
    `/api/console/providers/${encodeURIComponent(name)}`,
    { method: "DELETE" }
  );

export const restartProvider = (name: string) =>
  fetchJSON<{ status: string; provider: ProviderInfo }>(
    `/api/console/providers/${encodeURIComponent(name)}/restart`,
    { method: "POST" }
  );

// --- Provider Tools ---
export interface MCPToolDetail {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface ProviderTools {
  provider: string;
  tools: string[];
  toolDetails: MCPToolDetail[];
  toolMapping: Record<string, string>;
}

export const getProviderTools = (name: string) =>
  fetchJSON<ProviderTools>(
    `/api/console/providers/${encodeURIComponent(name)}/tools`
  );

// --- Provider Schema ---
export interface GraphSchema {
  categories: Array<{
    name: string;
    count?: number;
    properties?: Array<{ name: string; type: string }>;
  }>;
  relationships: Array<{
    type: string;
    startCategory: string;
    endCategory: string;
    count?: number;
    properties?: Array<{ name: string; type: string }>;
  }>;
}

export const getProviderSchema = (name: string, dataset?: string) => {
  const params = dataset ? `?dataset=${encodeURIComponent(dataset)}` : "";
  return fetchJSON<{ provider: string; dataset: string; schema: GraphSchema }>(
    `/api/console/providers/${encodeURIComponent(name)}/schema${params}`
  );
};

// --- Provider Templates ---
export interface ProviderTemplate {
  id: string;
  label: string;
  description: string;
  databaseType: DatabaseType;
  transport: "stdio" | "http";
  toolMapping: Record<string, string>;
  defaults: Partial<ProviderConfig>;
  requiredFields: string[];
  envHints: Record<string, string>;
}

export const getTemplates = () =>
  fetchJSON<{ templates: ProviderTemplate[] }>("/api/console/templates").then(
    (r) => r.templates
  );

export const getTemplate = (id: string) =>
  fetchJSON<{ template: ProviderTemplate }>(
    `/api/console/templates/${encodeURIComponent(id)}`
  ).then((r) => r.template);

// --- Sessions ---
export interface Session {
  id: string;
  origin: string;
  scopes: string[];
  status: "pending" | "approved" | "denied";
  createdAt: string;
}

export const getSessions = () =>
  fetchJSON<{ sessions: Session[] }>("/api/console/sessions").then(
    (r) => r.sessions
  );

// --- Tokens ---
export interface TokenInfo {
  tokenPrefix: string;
  origin: string;
  expiresAt: string;
}

export const getTokens = () =>
  fetchJSON<{ tokens: TokenInfo[] }>("/api/console/tokens").then(
    (r) => r.tokens
  );

export const revokeToken = (tokenPrefix: string) =>
  fetchJSON<{ status: string }>(`/api/console/tokens/${tokenPrefix}`, {
    method: "DELETE",
  });

export const createToken = (data: { origin?: string }) =>
  fetchJSON<{ token: string; tokenPrefix: string; expiresAt: string }>(
    "/api/console/tokens",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }
  );

export const revokeAllTokens = () =>
  fetchJSON<{ status: string; count: number }>("/api/console/tokens", {
    method: "DELETE",
  });

// --- Settings ---
export interface Settings {
  port: number;
  authEnabled: boolean;
  rateLimitEnabled: boolean;
  allowedOrigins: string[];
  tokenTTL: number;
  pairingTimeout: number;
  rateLimit: { windowMs: number; max: number };
}

export const getSettings = () => fetchJSON<Settings>("/api/console/settings");

export const updateSettings = (data: Partial<Settings>) =>
  fetchJSON<Settings>("/api/console/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

// --- Self-Test ---
export interface SelfTestResult {
  name: string;
  status: "pass" | "fail" | "skip";
  detail: string;
}

export const runSelfTest = () =>
  fetchJSON<{ results: SelfTestResult[]; overall: string }>(
    "/api/console/self-test",
    { method: "POST" }
  );

// --- Connection Events ---
export interface ConnectionEvent {
  provider: string;
  event: "connected" | "disconnected" | "error" | "reconnecting" | "health_ok" | "health_fail";
  timestamp: number;
  detail?: string;
}

export const getConnectionEvents = (limit = 50) =>
  fetchJSON<{ events: ConnectionEvent[] }>(
    `/api/console/events?limit=${limit}`
  ).then((r) => r.events);

export const getProviderEvents = (name: string, limit = 20) =>
  fetchJSON<{ provider: string; events: ConnectionEvent[] }>(
    `/api/console/providers/${encodeURIComponent(name)}/events?limit=${limit}`
  ).then((r) => r.events);

// --- Provider Connection Test ---
export interface ProviderTestResult {
  provider: string;
  dataset: string;
  overall: "pass" | "fail";
  results: Array<{ check: string; status: "pass" | "fail"; detail: string; ms: number }>;
}

export const testProviderConnection = (name: string) =>
  fetchJSON<ProviderTestResult>(
    `/api/console/providers/${encodeURIComponent(name)}/test`,
    { method: "POST" }
  );

// --- SSE Events Stream ---
export function subscribeToEvents(
  onConnection: (event: ConnectionEvent) => void,
  onProviders: (providers: ProviderInfo[]) => void,
): () => void {
  let es: EventSource | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  function connect() {
    if (stopped) return;
    es = new EventSource("/api/console/events/stream");
    es.addEventListener("connection", (e) => {
      try { onConnection(JSON.parse(e.data)); } catch { /* ignore */ }
    });
    es.addEventListener("providers", (e) => {
      try { onProviders(JSON.parse(e.data)); } catch { /* ignore */ }
    });
    es.onerror = () => {
      es?.close();
      es = null;
      if (!stopped) {
        reconnectTimer = setTimeout(connect, 5000);
      }
    };
  }

  connect();

  return () => {
    stopped = true;
    es?.close();
    if (reconnectTimer) clearTimeout(reconnectTimer);
  };
}

// --- Health ---
export interface HealthResponse {
  status: string;
  version: string;
  providers: Array<{ name: string; status: string; databaseType: string }>;
}

export const getHealth = () => fetchJSON<HealthResponse>("/health");

// --- Graph (for explorer via console API — no auth required) ---
export interface TestQueryResult {
  success: boolean;
  provider: string;
  dataset: string;
  executionTime: number;
  nodeCount?: number;
  edgeCount?: number;
  data?: any;
  error?: string;
}

export const consoleTestQuery = (name: string, body: {
  dataset?: string;
  parameters?: Record<string, unknown>;
  query: string;
  limit?: number;
}) =>
  fetchJSON<TestQueryResult>(
    `/api/console/providers/${encodeURIComponent(name)}/test-query`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

// --- Graph (authed endpoints for external clients) ---
export const graphNeighbors = (body: {
  provider: string;
  dataset: string;
  nodeId: string;
  limit?: number;
}) =>
  fetchJSON<any>("/graph/neighbors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

export const graphQuery = (body: {
  provider: string;
  dataset: string;
  query: string;
  limit?: number;
}) =>
  fetchJSON<any>("/graph/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
