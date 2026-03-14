import { useEffect, useState } from "react";
import { Card, Typography, Tabs, Tag, Space, Button, Alert, Descriptions } from "antd";
import { App as AntdApp } from "antd";
import { CopyOutlined, CheckCircleOutlined, LinkOutlined, ApiOutlined } from "@ant-design/icons";
import { getProviders, getSettings, type ProviderInfo, type Settings } from "../api.ts";

const { Text, Title, Paragraph } = Typography;

const CODE_STYLE: React.CSSProperties = {
  background: "#12141c",
  padding: 16,
  borderRadius: 8,
  overflow: "auto",
  fontSize: 13,
  lineHeight: 1.6,
  color: "#e0e0e0",
  margin: 0,
  border: "1px solid #2a2d3a",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

function CodeBlock({ code, language }: { code: string; language: string }) {
  const { message } = AntdApp.useApp();
  return (
    <div style={{ position: "relative" }}>
      <Tag style={{ position: "absolute", top: 8, right: 8, fontSize: 10 }}>{language}</Tag>
      <Button
        size="small"
        icon={<CopyOutlined />}
        style={{ position: "absolute", top: 8, right: 70, opacity: 0.7 }}
        onClick={() => {
          navigator.clipboard.writeText(code);
          message.success("Copied!");
        }}
      />
      <pre style={CODE_STYLE}>{code}</pre>
    </div>
  );
}

function generateFetchExample(baseUrl: string, provider?: ProviderInfo, authEnabled?: boolean) {
  const dataset = provider?.datasets?.[0] ?? "my-dataset";
  const name = provider?.name ?? "my-provider";
  const authHeader = authEnabled ? `\n    "Authorization": "Bearer YOUR_TOKEN",` : "";

  return `// 1. Check health
const health = await fetch("${baseUrl}/health").then(r => r.json());
console.log(health.status); // "ok"

// 2. List providers
const { providers } = await fetch("${baseUrl}/api/providers", {
  headers: {${authHeader}
    "Content-Type": "application/json"
  }
}).then(r => r.json());

// 3. Get graph schema
const schema = await fetch("${baseUrl}/api/providers/${name}/graphSchema?dataset=${dataset}", {
  headers: {${authHeader}
    "Content-Type": "application/json"
  }
}).then(r => r.json());
console.log(schema.schema.categories); // [{name: "Person", ...}]

// 4. Run a query
const result = await fetch("${baseUrl}/api/providers/${name}/query", {
  method: "POST",
  headers: {${authHeader}
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    query: "MATCH (n) RETURN n LIMIT 10",
    dataset: "${dataset}"
  })
}).then(r => r.json());

console.log(result.nodes);  // [{id, labels, properties}, ...]
console.log(result.edges);  // [{id, type, startNodeId, endNodeId, properties}, ...]`;
}

function generateCurlExample(baseUrl: string, provider?: ProviderInfo, authEnabled?: boolean) {
  const dataset = provider?.datasets?.[0] ?? "my-dataset";
  const name = provider?.name ?? "my-provider";
  const authFlag = authEnabled ? ' \\\n  -H "Authorization: Bearer YOUR_TOKEN"' : "";

  return `# Health check
curl ${baseUrl}/health

# List providers
curl ${baseUrl}/api/providers${authFlag}

# Get graph schema
curl "${baseUrl}/api/providers/${name}/graphSchema?dataset=${dataset}"${authFlag}

# Run a query
curl -X POST ${baseUrl}/api/providers/${name}/query${authFlag} \\
  -H "Content-Type: application/json" \\
  -d '{"query": "MATCH (n) RETURN n LIMIT 10", "dataset": "${dataset}"}'`;
}

function generatePythonExample(baseUrl: string, provider?: ProviderInfo, authEnabled?: boolean) {
  const dataset = provider?.datasets?.[0] ?? "my-dataset";
  const name = provider?.name ?? "my-provider";
  const authLine = authEnabled ? '\nheaders = {"Authorization": "Bearer YOUR_TOKEN", "Content-Type": "application/json"}' : '\nheaders = {"Content-Type": "application/json"}';

  return `import requests

BASE = "${baseUrl}"${authLine}

# Health check
health = requests.get(f"{BASE}/health").json()
print(health["status"])  # "ok"

# Get schema
schema = requests.get(
    f"{BASE}/api/providers/${name}/graphSchema?dataset=${dataset}",
    headers=headers
).json()
print(f"{len(schema['schema']['categories'])} categories")

# Run query
result = requests.post(
    f"{BASE}/api/providers/${name}/query",
    headers=headers,
    json={"query": "MATCH (n) RETURN n LIMIT 10", "dataset": "${dataset}"}
).json()
print(f"{len(result.get('nodes', []))} nodes, {len(result.get('edges', []))} edges")`;
}

function generateClaudeToolUse(baseUrl: string, provider?: ProviderInfo) {
  const dataset = provider?.datasets?.[0] ?? "my-dataset";
  const name = provider?.name ?? "my-provider";

  return `import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// Define the gateway as a tool for Claude
const tools = [
  {
    name: "query_graph",
    description: "Query a graph database via GraphXR Gateway. Returns nodes and edges.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Cypher query to execute" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_graph_schema",
    description: "Get the graph schema (node categories and relationship types).",
    input_schema: { type: "object", properties: {} },
  },
];

// Handle tool calls by forwarding to the gateway
async function handleToolCall(name: string, input: any) {
  const base = "${baseUrl}";
  if (name === "query_graph") {
    return fetch(\`\${base}/api/providers/${name}/query\`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: input.query, dataset: "${dataset}" }),
    }).then(r => r.json());
  }
  if (name === "get_graph_schema") {
    return fetch(\`\${base}/api/providers/${name}/graphSchema?dataset=${dataset}\`)
      .then(r => r.json());
  }
}

// Chat with Claude using the graph tools
const response = await client.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  tools,
  messages: [
    { role: "user", content: "What are the main node types in the graph?" }
  ],
});

// Process tool use responses
for (const block of response.content) {
  if (block.type === "tool_use") {
    const result = await handleToolCall(block.name, block.input);
    console.log(\`Tool \${block.name}:\`, result);
  }
}`;
}

function generateMCPClientExample(provider?: ProviderInfo) {
  return `import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// Connect directly to the same MCP server the gateway uses
// (This is what the gateway does internally)
const transport = new StdioClientTransport({
  command: "neo4j-mcp-server",  // or your MCP server command
  env: {
    NEO4J_URI: "bolt://localhost:7687",
    NEO4J_USERNAME: "neo4j",
    NEO4J_PASSWORD: "password",
  },
});

const client = new Client({ name: "my-ai-agent", version: "1.0.0" });
await client.connect(transport);

// Discover available tools
const { tools } = await client.listTools();
console.log("Available tools:", tools.map(t => t.name));

// Call a tool directly
const result = await client.callTool({
  name: "read-cypher",  // tool name from MCP server
  arguments: {
    query: "MATCH (n:Person) RETURN n.name LIMIT 5",
  },
});
console.log(result);

// Or use with Claude via MCP tool integration
// See: https://docs.anthropic.com/en/docs/agents-and-tools/mcp`;
}

function generateOpenAIFunctionExample(baseUrl: string, provider?: ProviderInfo) {
  const dataset = provider?.datasets?.[0] ?? "my-dataset";
  const name = provider?.name ?? "my-provider";

  return `import OpenAI from "openai";

const openai = new OpenAI();

// Define gateway endpoints as OpenAI function tools
const tools = [
  {
    type: "function",
    function: {
      name: "query_graph",
      description: "Execute a Cypher query on the graph database",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Cypher query string" },
        },
        required: ["query"],
      },
    },
  },
];

// Forward function calls to the gateway
async function callGateway(query: string) {
  return fetch("${baseUrl}/api/providers/${name}/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, dataset: "${dataset}" }),
  }).then(r => r.json());
}

const response = await openai.chat.completions.create({
  model: "gpt-4",
  tools,
  messages: [
    { role: "user", content: "Find all Person nodes connected to Company nodes" },
  ],
});

// Handle tool calls
for (const choice of response.choices) {
  for (const call of choice.message.tool_calls ?? []) {
    if (call.function.name === "query_graph") {
      const args = JSON.parse(call.function.arguments);
      const result = await callGateway(args.query);
      console.log(\`\${result.nodes?.length ?? 0} nodes found\`);
    }
  }
}`;
}

function generateGraphXRSnippet(baseUrl: string, authEnabled?: boolean) {
  const authNote = authEnabled
    ? "// When auth is enabled, GraphXR will use the pairing flow automatically"
    : "// Auth is disabled — GraphXR connects directly without pairing";

  return `${authNote}

// In GraphXR Settings → Data Source:
//   Type: GraphXR Gateway
//   URL:  ${baseUrl}
//
// The gateway is compatible with graphxr-database-proxy API format.
// GraphXR will auto-discover providers and datasets.

// Data format returned by the gateway:
interface GNode {
  id: string;
  labels: string[];        // e.g. ["Person", "Employee"]
  properties: Record<string, unknown>;
}

interface GEdge {
  id: string;
  type: string;            // e.g. "WORKS_AT"
  startNodeId: string;
  endNodeId: string;
  properties: Record<string, unknown>;
}`;
}

export default function Integration() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    getProviders().then(setProviders).catch(() => {});
    getSettings().then(setSettings).catch(() => {});
  }, []);

  const port = settings?.port ?? 19285;
  const baseUrl = `http://127.0.0.1:${port}`;
  const firstProvider = providers.find((p) => p.status === "connected") ?? providers[0];
  const authEnabled = settings?.authEnabled ?? false;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>Integration Guide</Title>
      </div>

      {/* Quick Info */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="small">
          <Descriptions.Item label="Gateway URL">
            <Text code copyable>{baseUrl}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Auth">
            <Tag color={authEnabled ? "green" : "default"}>
              {authEnabled ? "Bearer Token Required" : "Disabled (open access)"}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Providers">
            <Space>
              {providers.length === 0 ? (
                <Text type="secondary">None configured</Text>
              ) : (
                providers.map((p) => (
                  <Tag key={p.name} color={p.status === "connected" ? "green" : "red"}>
                    {p.name}
                  </Tag>
                ))
              )}
            </Space>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {providers.length === 0 && (
        <Alert
          type="info"
          showIcon
          message="Add a provider first"
          description="Integration examples will use your actual provider name and dataset once configured."
          style={{ marginBottom: 16 }}
        />
      )}

      {/* API Endpoints Reference */}
      <Card
        title={<Space><LinkOutlined /> API Endpoints</Space>}
        size="small"
        style={{ marginBottom: 16 }}
      >
        <div style={{ display: "grid", gap: 8 }}>
          <EndpointRow method="GET" path="/health" desc="Gateway health + provider status" />
          <EndpointRow method="GET" path="/api/providers" desc="List all providers with datasets" auth={authEnabled} />
          <EndpointRow method="GET" path="/api/providers/:name/graphSchema" desc="Graph schema (categories + relationships)" auth={authEnabled} />
          <EndpointRow method="GET" path="/api/providers/:name/schema" desc="Raw schema as GraphDelta" auth={authEnabled} />
          <EndpointRow method="POST" path="/api/providers/:name/query" desc="Execute graph query" auth={authEnabled} />
        </div>
      </Card>

      {/* API Examples */}
      <Card title={<Space><CheckCircleOutlined /> API Examples</Space>} size="small">
        <Tabs
          items={[
            {
              key: "fetch",
              label: "JavaScript / Fetch",
              children: (
                <CodeBlock
                  code={generateFetchExample(baseUrl, firstProvider, authEnabled)}
                  language="JavaScript"
                />
              ),
            },
            {
              key: "curl",
              label: "cURL",
              children: (
                <CodeBlock
                  code={generateCurlExample(baseUrl, firstProvider, authEnabled)}
                  language="bash"
                />
              ),
            },
            {
              key: "python",
              label: "Python",
              children: (
                <CodeBlock
                  code={generatePythonExample(baseUrl, firstProvider, authEnabled)}
                  language="Python"
                />
              ),
            },
            {
              key: "graphxr",
              label: "GraphXR",
              children: (
                <CodeBlock
                  code={generateGraphXRSnippet(baseUrl, authEnabled)}
                  language="TypeScript"
                />
              ),
            },
          ]}
        />
      </Card>

      {/* AI Integration */}
      <Card
        title={<Space><ApiOutlined /> AI Integration</Space>}
        size="small"
        style={{ marginTop: 16 }}
      >
        <Paragraph type="secondary" style={{ marginBottom: 12 }}>
          Use the gateway as a tool backend for AI agents. The gateway API can be called from any LLM framework.
        </Paragraph>
        <Tabs
          items={[
            {
              key: "claude",
              label: "Claude (Anthropic)",
              children: (
                <CodeBlock
                  code={generateClaudeToolUse(baseUrl, firstProvider)}
                  language="TypeScript"
                />
              ),
            },
            {
              key: "openai",
              label: "OpenAI",
              children: (
                <CodeBlock
                  code={generateOpenAIFunctionExample(baseUrl, firstProvider)}
                  language="TypeScript"
                />
              ),
            },
            {
              key: "mcp",
              label: "MCP Client (Direct)",
              children: (
                <>
                  <Alert
                    type="info"
                    showIcon
                    message="Direct MCP connection bypasses the gateway and connects to the MCP server directly."
                    style={{ marginBottom: 12 }}
                  />
                  <CodeBlock
                    code={generateMCPClientExample(firstProvider)}
                    language="TypeScript"
                  />
                </>
              ),
            },
          ]}
        />
      </Card>

      {/* Data Format */}
      <Card title="Response Data Format" size="small" style={{ marginTop: 16 }}>
        <Paragraph type="secondary" style={{ marginBottom: 12 }}>
          Query results use the GraphXR-compatible format (same as graphxr-database-proxy):
        </Paragraph>
        <CodeBlock
          code={`{
  "nodes": [
    {
      "id": "abc123",
      "labels": ["Person"],
      "properties": { "name": "Alice", "age": 30 }
    }
  ],
  "edges": [
    {
      "id": "edge456",
      "type": "KNOWS",
      "startNodeId": "abc123",
      "endNodeId": "def789",
      "properties": { "since": 2020 }
    }
  ],
  "summary": {
    "counts": { "nodes": 1, "edges": 1 },
    "executionTime": 42
  }
}`}
          language="JSON"
        />
      </Card>
    </div>
  );
}

function EndpointRow({ method, path, desc, auth }: { method: string; path: string; desc: string; auth?: boolean }) {
  const color = method === "GET" ? "green" : method === "POST" ? "blue" : "orange";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <Tag color={color} style={{ width: 48, textAlign: "center", margin: 0, flexShrink: 0 }}>{method}</Tag>
      <Text code style={{ fontSize: 12, flexShrink: 0 }}>{path}</Text>
      <Text type="secondary" style={{ fontSize: 12 }}>{desc}</Text>
      {auth && <Tag style={{ fontSize: 10, margin: 0 }}>auth</Tag>}
    </div>
  );
}
