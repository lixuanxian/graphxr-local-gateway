export interface ProviderConfig {
  name: string;
  transport: "stdio" | "http";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  endpoint?: string;
  datasets: string[];
}

export interface RateLimitConfig {
  windowMs: number;
  max: number;
}

export interface GatewayConfig {
  port: number;
  allowedOrigins: string[];
  tokenTTL: number;
  pairingTimeout: number;
  rateLimit: RateLimitConfig;
  providers: ProviderConfig[];
}
