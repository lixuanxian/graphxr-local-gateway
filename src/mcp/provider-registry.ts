import type { BaseAdapter } from "./adapters/base-adapter.js";
import type { ProviderConfig } from "../types/config.js";
import type { DatabaseType } from "../types/graph-delta.js";

export interface ProviderInfo {
  name: string;
  transport: string;
  databaseType: DatabaseType;
  datasets: string[];
  status: "connected" | "disconnected" | "error";
}

export class ProviderRegistry {
  private adapters = new Map<string, BaseAdapter>();
  private configs = new Map<string, ProviderConfig>();
  private statuses = new Map<string, "connected" | "disconnected" | "error">();

  register(config: ProviderConfig, adapter: BaseAdapter): void {
    this.configs.set(config.name, config);
    this.adapters.set(config.name, adapter);
    this.statuses.set(config.name, "connected");
  }

  unregister(name: string): void {
    this.adapters.delete(name);
    this.configs.delete(name);
    this.statuses.delete(name);
  }

  getAdapter(name: string): BaseAdapter | undefined {
    return this.adapters.get(name);
  }

  getConfig(name: string): ProviderConfig | undefined {
    return this.configs.get(name);
  }

  setStatus(name: string, status: "connected" | "disconnected" | "error"): void {
    this.statuses.set(name, status);
  }

  listProviders(): ProviderInfo[] {
    const result: ProviderInfo[] = [];
    for (const [name, config] of this.configs) {
      result.push({
        name,
        transport: config.transport,
        databaseType: config.databaseType ?? "generic",
        datasets: config.datasets,
        status: this.statuses.get(name) ?? "disconnected",
      });
    }
    return result;
  }

  listDatasets(providerName: string): string[] | null {
    const config = this.configs.get(providerName);
    return config ? config.datasets : null;
  }
}
