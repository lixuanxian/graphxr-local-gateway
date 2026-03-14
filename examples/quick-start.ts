/**
 * GraphXR Local Gateway — Quick Start
 *
 * Usage:
 *   1. Start the gateway:  npm run dev
 *   2. Add a provider via Console:  http://127.0.0.1:19285/console/
 *   3. Run this:  npx tsx examples/quick-start.ts
 */

const GATEWAY = "http://127.0.0.1:19285";

async function api(path: string, body?: object) {
  const res = await fetch(`${GATEWAY}${path}`, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

async function main() {
  // Check health
  const health = await api("/health");
  console.log(`Gateway: ${health.status} (v${health.version})`);

  // Get first provider
  const { providers } = await api("/api/providers");
  if (providers.length === 0) {
    console.log("\nNo providers configured.");
    console.log(`Open ${GATEWAY}/console/ to add one.`);
    return;
  }

  const { name, datasets } = providers[0];
  console.log(`Provider: ${name}, Dataset: ${datasets[0]}`);

  // Get schema
  const schema = await api(`/api/providers/${name}/graphSchema?dataset=${datasets[0]}`);
  console.log(`Schema: ${schema.schema?.categories?.length ?? 0} categories, ${schema.schema?.relationships?.length ?? 0} relationships`);

  // Run query
  const result = await api(`/api/providers/${name}/query`, {
    query: "MATCH (n) RETURN n LIMIT 5",
    dataset: datasets[0],
  });
  console.log(`Query: ${result.nodes?.length ?? 0} nodes, ${result.edges?.length ?? 0} edges`);

  console.log(`\nConsole: ${GATEWAY}/console/`);
}

main().catch(console.error);
