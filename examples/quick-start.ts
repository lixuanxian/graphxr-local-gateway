/**
 * GraphXR Local Gateway — Quick Start Example
 *
 * This example shows how to connect to the gateway and run a graph query.
 *
 * Prerequisites:
 *   1. Start the gateway: npm run dev
 *   2. Run this example: npx tsx examples/quick-start.ts
 *
 * By default, the gateway runs with auth disabled, so no token is needed.
 * If auth is enabled in Settings, you'll need to create a token first
 * via the Console (Sessions & Tokens → Create Token).
 */

const GATEWAY_URL = "http://127.0.0.1:19285";

// Optional: set this if auth is enabled
const TOKEN = process.env.GATEWAY_TOKEN || "";

async function main() {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (TOKEN) {
    headers["Authorization"] = `Bearer ${TOKEN}`;
  }

  // 1. Check gateway health
  console.log("1. Checking gateway health...");
  const health = await fetch(`${GATEWAY_URL}/health`).then((r) => r.json());
  console.log(`   Status: ${health.status}`);
  console.log(`   Version: ${health.version}`);
  console.log(`   Providers: ${health.providers.map((p: any) => `${p.name} (${p.status})`).join(", ")}`);
  console.log();

  // 2. List available providers
  console.log("2. Listing providers...");
  const catalog = await fetch(`${GATEWAY_URL}/api/providers`, { headers }).then((r) => r.json());
  for (const p of catalog.providers) {
    console.log(`   ${p.name} [${p.databaseType}] — datasets: ${p.datasets.join(", ")}`);
  }
  console.log();

  if (catalog.providers.length === 0) {
    console.log("   No providers configured. Add one via the Console at:");
    console.log(`   ${GATEWAY_URL}/console/`);
    return;
  }

  const provider = catalog.providers[0];
  const dataset = provider.datasets[0];

  // 3. Get graph schema
  console.log(`3. Getting schema for ${provider.name}/${dataset}...`);
  const schemaRes = await fetch(
    `${GATEWAY_URL}/api/providers/${provider.name}/graphSchema?dataset=${dataset}`,
    { headers }
  ).then((r) => r.json());
  const schema = schemaRes.schema ?? schemaRes;
  console.log(`   Categories: ${schema.categories?.map((c: any) => c.name).join(", ") || "none"}`);
  console.log(`   Relationships: ${schema.relationships?.map((r: any) => r.name).join(", ") || "none"}`);
  console.log();

  // 4. Run a query
  console.log(`4. Running query on ${provider.name}/${dataset}...`);
  const queryResult = await fetch(
    `${GATEWAY_URL}/api/providers/${provider.name}/query`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: "MATCH (n) RETURN n LIMIT 5",
        parameters: {},
        dataset,
      }),
    }
  ).then((r) => r.json());

  if (queryResult.nodes) {
    console.log(`   Nodes: ${queryResult.nodes.length}`);
    console.log(`   Edges: ${queryResult.edges?.length ?? 0}`);
    for (const node of queryResult.nodes.slice(0, 3)) {
      console.log(`   - ${node.id} [${node.labels?.join(", ")}] ${JSON.stringify(node.properties).slice(0, 80)}`);
    }
  } else {
    console.log(`   Result:`, JSON.stringify(queryResult).slice(0, 200));
  }
  console.log();
  console.log("Done! Open the Console for a visual interface:");
  console.log(`${GATEWAY_URL}/console/`);
}

main().catch(console.error);
