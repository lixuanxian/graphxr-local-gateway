# CLAUDE.md — GraphXR Local Gateway

## Project Overview

GraphXR Local Gateway is a localhost-only HTTP service that bridges GraphXR Web (browser) to multiple graph data sources via MCP (Model Context Protocol). It binds to `127.0.0.1:19285` and provides a secure pairing-based auth flow.

The gateway connects to graph databases (Neo4j, Spanner Graph, etc.) through their MCP servers, providing a unified GraphXR-compatible API regardless of the underlying database.

## Tech Stack

- **Backend**: Node.js + Express 5, TypeScript, ESM modules
- **Frontend (Console)**: React 19 + Ant Design 5 + Vite 6, dark theme
- **Build**: `tsup` (backend), `vite` (console)
- **Test**: Vitest + Supertest
- **MCP SDK**: `@modelcontextprotocol/sdk` (stdio + HTTP/SSE transports)

## Project Structure

```
src/                        # Backend source (Express)
  index.ts                  # Entry point, config loading, server startup
  server.ts                 # Express app factory (middleware + routes)
  config/
    config-manager.ts       # Runtime config management + persistence
  middleware/                # cors, auth (bearer token), host-guard (DNS rebinding protection)
  routes/
    health.ts               # GET /health
    pair.ts                 # Pairing flow (start, status, approve, deny)
    graph.ts                # Graph operations (schema, neighbors, expand, query)
    catalog.ts              # Provider/dataset discovery
    proxy.ts                # graphxr-database-proxy compatible API
    console.ts              # Gateway management API
  pairing/                  # PairingManager — session & token lifecycle
  mcp/
    mcp-manager.ts          # MCP connection lifecycle (stdio + HTTP/SSE), tool auto-discovery
    provider-registry.ts    # Provider registry (adapters + status + databaseType)
    provider-templates.ts   # Pre-configured templates for Neo4j, Spanner, etc.
    adapters/
      base-adapter.ts       # Interface: getSchema, getGraphSchema, getNeighbors, expand, query
      mcp-adapter.ts        # Generic MCP tool caller → GraphDelta converter (db-type-aware)
      mock-adapter.ts       # Hardcoded demo data
  types/
    graph-delta.ts          # GNode (id, labels[], properties), GEdge (startNodeId/endNodeId), GraphSchema, QueryResponse
    config.ts               # ProviderConfig (with databaseType, toolMapping), GatewayConfig
    api.ts                  # API request/response types + ProxyQueryRequest
  utils/                    # logger, open-browser
console/                    # React frontend (Vite project)
  src/
    App.tsx                 # Layout + client-side routing
    api.ts                  # API client with full type definitions
    pages/                  # Dashboard, Providers, SchemaExplorer, Sessions, GraphExplorer, Settings
    components/             # StatusBadge, ProviderModal (with template quick-setup)
tests/                      # Vitest test files (69 tests)
gateway.config.json         # Runtime config
```

## Common Commands

```bash
npm run dev          # Dev: frontend + backend concurrently
npm run dev:server   # Backend only (tsx watch)
npm run dev:web      # Console frontend (HMR, proxies to backend)
npm run build:web    # Build console to public/console/
npm run build:server # Build backend to dist/
npm test             # Run all tests
npm start            # Production
```

## Data Model (graphxr-database-proxy compatible)

```typescript
// Node: id + labels array + properties object
interface GNode {
  id: string;
  labels: string[];
  properties: Record<string, unknown>;
}

// Edge: startNodeId/endNodeId (not src/dst)
interface GEdge {
  id: string;
  type: string;
  startNodeId: string;
  endNodeId: string;
  properties: Record<string, unknown>;
}

// Schema: categories + relationships with property type definitions
interface GraphSchema {
  categories: CategorySchema[];    // { name, props[], propsTypes, keys[], ... }
  relationships: RelationshipSchema[];  // { name, startCategory, endCategory, ... }
}
```

## API Endpoints

### Proxy-Compatible API (matches graphxr-database-proxy)
Requires bearer auth. Dataset auto-resolved when provider has exactly one.
- `GET /api/providers` — List all providers with API URLs
- `GET /api/providers/:provider` — Provider info + endpoint URLs
- `POST /api/providers/:provider/query` — Execute query `{query, parameters}`
- `GET /api/providers/:provider/graphSchema` — Graph schema (categories + relationships)
- `GET /api/providers/:provider/schema` — Raw schema as GraphDelta

### Gateway Graph API (internal)
- `POST /graph/schema` — Get schema via provider/dataset
- `POST /graph/neighbors` — Fetch neighbors of a node
- `POST /graph/expand` — Expand multiple nodes
- `POST /graph/query` — Execute raw query

### Console API (local-only, no auth)
- `GET /api/console/stats` — Dashboard stats
- `GET /api/console/events` — Connection events log
- `GET /api/console/templates` — Available provider templates
- `GET /api/console/templates/:id` — Template detail
- `GET /api/console/providers` — Provider list (with MCP tools)
- `POST /api/console/providers` — Add provider
- `PUT /api/console/providers/:name` — Update provider
- `DELETE /api/console/providers/:name` — Remove provider
- `POST /api/console/providers/:name/restart` — Restart
- `GET /api/console/providers/:name/tools` — MCP tool introspection
- `GET /api/console/providers/:name/schema` — Graph schema for console
- `GET /api/console/providers/:name/events` — Provider connection events
- `GET/PUT /api/console/settings` — Gateway settings
- `GET /api/console/sessions` — Pairing sessions
- `GET /api/console/tokens` — Active tokens
- `POST /api/console/self-test` — Health checks

## MCP Provider Configuration

### Supported Transports
- **stdio**: Local process (command + args). Used for Neo4j official MCP, uvx-based servers.
- **http**: Remote HTTP/SSE (endpoint URL). Used for Spanner MCP Toolbox, managed MCP services.

### Provider Templates
Pre-configured templates for quick setup:
- `neo4j-official` — Neo4j Official MCP Server (tools: get-schema, read-cypher)
- `neo4j-labs` — Neo4j Labs mcp-neo4j-cypher (tools: get_schema, run_read_query)
- `spanner-toolbox` — Google Cloud Spanner MCP Toolbox (tools: spanner-list-graphs, spanner-sql)
- `spanner-managed` — Google Cloud managed MCP endpoint
- `generic` / `generic-http` — Any MCP server (auto-detected tools)

### Tool Auto-Discovery
When connecting to an MCP server, the gateway:
1. Lists all available tools via `client.listTools()`
2. Auto-maps tools to operations (schema, query, neighbors, expand) based on naming patterns
3. Supports explicit `toolMapping` override in provider config

### Config Example (gateway.config.json)
```json
{
  "port": 19285,
  "allowedOrigins": ["*"],
  "tokenTTL": 28800,
  "pairingTimeout": 300,
  "providers": [
    {
      "name": "my-neo4j",
      "transport": "stdio",
      "databaseType": "neo4j",
      "command": "neo4j-mcp-server",
      "args": [],
      "env": {
        "NEO4J_URI": "bolt://localhost:7687",
        "NEO4J_USERNAME": "neo4j",
        "NEO4J_PASSWORD": "password"
      },
      "datasets": ["movies"]
    },
    {
      "name": "my-spanner",
      "transport": "http",
      "databaseType": "spanner",
      "endpoint": "http://localhost:5000/mcp",
      "datasets": ["my-graph"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/sa.json"
      }
    }
  ]
}
```

## Testing

Tests in `tests/`, run with `npm test`. 69 tests across 10 files:
- `tests/middleware/cors.test.ts` — CORS middleware
- `tests/pairing/pairing-manager.test.ts` — Pairing lifecycle
- `tests/routes/health.test.ts` — Health + CORS integration
- `tests/routes/proxy.test.ts` — Proxy-compatible API (query, schema, graphSchema)
- `tests/routes/console-settings.test.ts` — Settings CRUD
- `tests/routes/console-providers.test.ts` — Provider CRUD
- `tests/routes/console-templates.test.ts` — Templates + tools API
- `tests/routes/console-self-test.test.ts` — Self-test endpoint
- `tests/routes/console-events.test.ts` — Connection events API
- `tests/mcp/mcp-adapter.test.ts` — MCP adapter data normalization (14 tests)

## Key Architecture Decisions

- **MCP-first**: All database connections go through MCP protocol, not direct drivers
- **Localhost only**: Server binds to `127.0.0.1`, never `0.0.0.0`
- **GraphXR compatible**: Data format matches graphxr-database-proxy (labels[], startNodeId/endNodeId)
- **Database-type aware**: Adapters normalize different MCP server outputs per database type
- **Dual transport**: stdio for local MCP servers, HTTP/SSE for remote/managed ones
- **Template-driven**: Pre-configured templates make adding Neo4j/Spanner providers easy
- **Dynamic config**: Providers can be managed at runtime via Console, persisted to disk
- **Health monitoring**: Periodic health checks (30s) with auto-reconnect on failure (up to 5 attempts)
- **Retry logic**: MCP tool calls retry up to 2 times on transient failures with exponential backoff
- **Connection events**: Full event log for monitoring connection lifecycle (connect, disconnect, reconnect, health)

## Console Pages

- **Dashboard**: Stats, connection events timeline, self-test
- **Providers**: CRUD table, detail drawer (tools, events, config), template quick-setup
- **Schema Explorer**: Browse node categories and relationships with property types
- **Sessions & Tokens**: Pairing history, active tokens with relative times, revoke with confirm
- **Graph Explorer**: Query with structured table view (nodes/edges), toggle JSON view, db-aware placeholders
- **Settings**: CORS, token TTL, pairing timeout with descriptions and validation
