/**
 * GraphXR Gateway Client — Reusable Integration Module
 *
 * Copy this class into your project to interact with GraphXR Local Gateway.
 *
 * Usage:
 *   const gw = new GatewayClient("http://127.0.0.1:19285");
 *   const result = await gw.query("my-neo4j", "movies", "MATCH (n) RETURN n LIMIT 10");
 *   console.log(result.nodes);
 */

export class GatewayClient {
  constructor(
    private baseUrl = "http://127.0.0.1:19285",
    private token?: string
  ) {}

  private async fetch<T = any>(path: string, body?: object): Promise<T> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.token) headers["Authorization"] = `Bearer ${this.token}`;

    const res = await fetch(`${this.baseUrl}${path}`, {
      method: body ? "POST" : "GET",
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  /** Check if the gateway is running */
  async health() {
    return this.fetch<{
      status: string;
      version: string;
      providers: Array<{ name: string; status: string; databaseType: string }>;
    }>("/health");
  }

  /** List all providers */
  async providers() {
    const res = await this.fetch<{
      providers: Array<{
        name: string;
        databaseType: string;
        datasets: string[];
        status: string;
      }>;
    }>("/api/providers");
    return res.providers;
  }

  /** Get graph schema for a provider */
  async schema(provider: string, dataset?: string) {
    const ds = dataset ? `?dataset=${encodeURIComponent(dataset)}` : "";
    const res = await this.fetch<{
      schema: {
        categories: Array<{ name: string; count?: number; properties?: Array<{ name: string; type: string }> }>;
        relationships: Array<{ type: string; startCategory: string; endCategory: string }>;
      };
    }>(`/api/providers/${encodeURIComponent(provider)}/graphSchema${ds}`);
    return res.schema;
  }

  /** Execute a graph query */
  async query(provider: string, dataset: string, query: string, params?: Record<string, unknown>) {
    return this.fetch<{
      nodes: Array<{ id: string; labels: string[]; properties: Record<string, unknown> }>;
      edges: Array<{ id: string; type: string; startNodeId: string; endNodeId: string; properties: Record<string, unknown> }>;
      summary?: { counts?: { nodes: number; edges: number }; executionTime?: number };
    }>(`/api/providers/${encodeURIComponent(provider)}/query`, {
      query,
      dataset,
      parameters: params ?? {},
    });
  }
}

// --- Example usage ---
async function demo() {
  const gw = new GatewayClient();

  // Check gateway
  const health = await gw.health();
  console.log(`Gateway ${health.status} (v${health.version})`);

  // List providers
  const providers = await gw.providers();
  if (providers.length === 0) {
    console.log("No providers. Open http://127.0.0.1:19285/console/ to add one.");
    return;
  }

  const p = providers[0];
  console.log(`Using: ${p.name} [${p.databaseType}]`);

  // Get schema
  const schema = await gw.schema(p.name, p.datasets[0]);
  console.log(`Categories: ${schema.categories.map(c => c.name).join(", ")}`);

  // Query
  const result = await gw.query(p.name, p.datasets[0], "MATCH (n) RETURN n LIMIT 5");
  console.log(`Got ${result.nodes.length} nodes, ${result.edges.length} edges`);

  for (const node of result.nodes) {
    console.log(`  ${node.id} [${node.labels.join(",")}]`);
  }
}

demo().catch(console.error);
