import type { ProviderConfig, MCPToolMapping } from "../types/config.js";
import type { DatabaseType } from "../types/graph-delta.js";

// ---------------------------------------------------------------------------
// Provider template — pre-configured settings for known MCP servers
// ---------------------------------------------------------------------------

export interface ProviderTemplate {
  id: string;
  label: string;
  description: string;
  databaseType: DatabaseType;
  transport: "stdio" | "http";
  toolMapping: MCPToolMapping;
  // Template for command/args (stdio) or endpoint (http)
  defaults: Partial<ProviderConfig>;
  // Fields the user must fill in
  requiredFields: string[];
  // Environment variables the user may need to set
  envHints: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Neo4j Official MCP Server (binary)
// https://github.com/neo4j/mcp
// Tools: get-schema, read-cypher, write-cypher, list-gds-procedures
// ---------------------------------------------------------------------------

const neo4jOfficialTemplate: ProviderTemplate = {
  id: "neo4j-official",
  label: "Neo4j (Official MCP Server)",
  description:
    "Connect to Neo4j via the official Neo4j MCP Server binary. " +
    "Supports Cypher queries, schema introspection, and GDS procedures.",
  databaseType: "neo4j",
  transport: "stdio",
  toolMapping: {
    schema: "get-schema",
    query: "read-cypher",
    // No dedicated neighbors/expand tools — use Cypher queries
  },
  defaults: {
    command: "neo4j-mcp-server",
    args: [],
  },
  requiredFields: ["name", "datasets"],
  envHints: {
    NEO4J_URI: "bolt://localhost:7687",
    NEO4J_USERNAME: "neo4j",
    NEO4J_PASSWORD: "your-password",
    NEO4J_DATABASE: "neo4j",
    NEO4J_READ_ONLY: "true",
  },
};

// ---------------------------------------------------------------------------
// Neo4j Labs MCP (mcp-neo4j-cypher)
// https://github.com/neo4j-contrib/mcp-neo4j
// Tools: run_read_query, run_write_query, get_schema
// ---------------------------------------------------------------------------

const neo4jLabsTemplate: ProviderTemplate = {
  id: "neo4j-labs",
  label: "Neo4j (Labs MCP - Cypher)",
  description:
    "Connect to Neo4j via the neo4j-contrib/mcp-neo4j Labs server. " +
    "Python-based, installable via uvx.",
  databaseType: "neo4j",
  transport: "stdio",
  toolMapping: {
    schema: "get_schema",
    query: "run_read_query",
  },
  defaults: {
    command: "uvx",
    args: ["mcp-neo4j-cypher"],
  },
  requiredFields: ["name", "datasets"],
  envHints: {
    NEO4J_URI: "bolt://localhost:7687",
    NEO4J_USERNAME: "neo4j",
    NEO4J_PASSWORD: "your-password",
    NEO4J_DATABASE: "neo4j",
  },
};

// ---------------------------------------------------------------------------
// Google Cloud Spanner MCP (via MCP Toolbox for Databases)
// https://googleapis.github.io/genai-toolbox/
// Tools: spanner-sql, spanner-execute-sql, spanner-list-tables, spanner-list-graphs
// ---------------------------------------------------------------------------

const spannerToolboxTemplate: ProviderTemplate = {
  id: "spanner-toolbox",
  label: "Spanner Graph (MCP Toolbox)",
  description:
    "Connect to Google Cloud Spanner Graph via the MCP Toolbox for Databases. " +
    "Supports SQL/GQL queries and graph schema introspection.",
  databaseType: "spanner",
  transport: "http",
  toolMapping: {
    schema: "spanner-list-graphs",
    query: "spanner-sql",
  },
  defaults: {
    endpoint: "http://localhost:5000/mcp",
  },
  requiredFields: ["name", "endpoint", "datasets"],
  envHints: {
    GOOGLE_APPLICATION_CREDENTIALS: "/path/to/service-account.json",
    SPANNER_PROJECT: "your-gcp-project",
    SPANNER_INSTANCE: "your-instance",
    SPANNER_DATABASE: "your-database",
  },
};

// ---------------------------------------------------------------------------
// Google Cloud Spanner Managed MCP (via Cloud console)
// Automatically enabled for Spanner instances
// ---------------------------------------------------------------------------

const spannerManagedTemplate: ProviderTemplate = {
  id: "spanner-managed",
  label: "Spanner Graph (Managed MCP)",
  description:
    "Connect to Spanner via Google Cloud's managed MCP endpoint. " +
    "Automatically available when Spanner is enabled in your GCP project.",
  databaseType: "spanner",
  transport: "http",
  toolMapping: {
    schema: "get_schema",
    query: "execute_query",
  },
  defaults: {},
  requiredFields: ["name", "endpoint", "datasets"],
  envHints: {
    AUTHORIZATION: "Bearer <your-access-token>",
  },
};

// ---------------------------------------------------------------------------
// Generic MCP Server
// ---------------------------------------------------------------------------

const genericTemplate: ProviderTemplate = {
  id: "generic",
  label: "Generic MCP Server",
  description:
    "Connect to any MCP server. Tool mapping will be auto-detected " +
    "from the server's available tools.",
  databaseType: "generic",
  transport: "stdio",
  toolMapping: {},
  defaults: {},
  requiredFields: ["name", "transport", "datasets"],
  envHints: {},
};

// ---------------------------------------------------------------------------
// Generic HTTP MCP Server
// ---------------------------------------------------------------------------

const genericHTTPTemplate: ProviderTemplate = {
  id: "generic-http",
  label: "Generic MCP Server (HTTP)",
  description:
    "Connect to any remote MCP server over HTTP/SSE. " +
    "Tool mapping will be auto-detected.",
  databaseType: "generic",
  transport: "http",
  toolMapping: {},
  defaults: {},
  requiredFields: ["name", "endpoint", "datasets"],
  envHints: {},
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const PROVIDER_TEMPLATES: ProviderTemplate[] = [
  neo4jOfficialTemplate,
  neo4jLabsTemplate,
  spannerToolboxTemplate,
  spannerManagedTemplate,
  genericTemplate,
  genericHTTPTemplate,
];

export function getTemplate(id: string): ProviderTemplate | undefined {
  return PROVIDER_TEMPLATES.find((t) => t.id === id);
}

export function getTemplatesForType(dbType: DatabaseType): ProviderTemplate[] {
  return PROVIDER_TEMPLATES.filter((t) => t.databaseType === dbType);
}
