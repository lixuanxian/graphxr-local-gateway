const BASE = "";

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, init);
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
export interface ProviderInfo {
  name: string;
  transport: string;
  datasets: string[];
  status: "connected" | "disconnected" | "error";
}

export interface ProviderConfig {
  name: string;
  transport: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  endpoint?: string;
  datasets: string[];
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

// --- Settings ---
export interface Settings {
  port: number;
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

// --- Health ---
export interface HealthResponse {
  status: string;
  version: string;
  providers: Array<{ name: string; status: string }>;
}

export const getHealth = () => fetchJSON<HealthResponse>("/health");

// --- Graph (for explorer) ---
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
