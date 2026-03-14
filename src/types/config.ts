import type { DatabaseType } from "./graph-delta.js";

// ---------------------------------------------------------------------------
// MCP Tool Mapping — maps gateway operations to MCP tool names
// ---------------------------------------------------------------------------

export interface MCPToolMapping {
  schema?: string;
  neighbors?: string;
  expand?: string;
  query?: string;
}

// ---------------------------------------------------------------------------
// Provider configuration
// ---------------------------------------------------------------------------

export interface ProviderConfig {
  name: string;
  transport: "stdio" | "http";
  databaseType: DatabaseType;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  endpoint?: string;
  datasets: string[];
  toolMapping?: MCPToolMapping;
}

// ---------------------------------------------------------------------------
// Gateway configuration
// ---------------------------------------------------------------------------

export interface RateLimitConfig {
  windowMs: number;
  max: number;
}

export interface GatewayConfig {
  port: number;
  authEnabled: boolean;
  rateLimitEnabled: boolean;
  allowedOrigins: string[];
  tokenTTL: number;
  pairingTimeout: number;
  rateLimit: RateLimitConfig;
  providers: ProviderConfig[];
}
