# CLAUDE.md — GraphXR Local Gateway

## Project Overview

GraphXR Local Gateway bridges GraphXR Web, AI coding tools, and custom apps to graph databases via MCP (Model Context Protocol). Binds to `127.0.0.1:19285`, optional auth (disabled by default).

**Dual mode**: HTTP gateway (Express) + MCP server (stdio) for AI tools.

**Critical**: All database connections go through MCP protocol, NOT direct drivers.

## Tech Stack

- **Backend**: Node.js + Express 5, TypeScript, ESM
- **Frontend**: React 19 + Ant Design 5 + Vite 6, dark theme
- **Build**: `tsup` (backend, dual entry), `vite` (console)
- **Test**: Vitest + Supertest (105 tests, 14 files)
- **MCP SDK**: `@modelcontextprotocol/sdk` (client + server)

## Project Structure

```
src/
  index.ts                  # HTTP gateway entry point
  mcp-server-entry.ts       # MCP server entry point (stdio, for AI tools)
  server.ts                 # Express app factory
  config/config-manager.ts  # Runtime config persistence
  middleware/               # cors, auth, host-guard, rate-limit
  routes/                   # health, pair, graph, catalog, proxy, console
  pairing/                  # PairingManager — session & token lifecycle
  mcp/
    mcp-manager.ts          # MCP client lifecycle (stdio + HTTP), tool auto-discovery, health checks
    mcp-server.ts           # MCP server — exposes gateway tools (list_providers, get_schema, query_graph, get_neighbors)
    provider-registry.ts    # Provider registry (adapters + status)
    provider-templates.ts   # Templates for Neo4j, Spanner, etc.
    adapters/
      base-adapter.ts       # Interface: getSchema, getGraphSchema, getNeighbors, expand, query
      mcp-adapter.ts        # MCP tool caller → GraphDelta converter (db-type-aware, retry)
      mock-adapter.ts       # Demo data for testing
  types/                    # graph-delta.ts, config.ts, api.ts
  utils/                    # logger.ts, open-browser.ts
console/src/
  App.tsx                   # Layout + routing + health indicator
  api.ts                    # API client with types
  pages/                    # Dashboard, Providers, Sessions, GraphExplorer, Integration, Settings
  components/               # StatusBadge, ProviderModal, ErrorBoundary
tests/                      # 14 test files
examples/                   # quick-start.ts, quick-start.html
```

## Commands

```bash
npm run dev          # Frontend + backend concurrently
npm run dev:server   # Backend only (tsx watch, port 19285)
npm run dev:web      # Console (Vite HMR, port 5173, proxies to backend)
npm run build:web    # Build console → public/console/
npm run build:server # Build backend → dist/ (dual entry: index + mcp-server-entry)
npm test             # Run all 105 tests
npm start            # HTTP gateway (production)
npm run start:mcp    # MCP server mode (stdio, for AI tools)
```

## MCP Server Mode (AI Tools)

The gateway exposes 4 MCP tools via stdio transport:
- `list_providers` — List connected graph databases
- `get_schema` — Graph schema (categories + relationships)
- `query_graph` — Execute Cypher/GQL/SQL queries
- `get_neighbors` — Graph traversal

Config for AI tools (Claude Code, Claude Desktop, Cursor, OpenCode):
```json
{
  "mcpServers": {
    "graphxr-gateway": {
      "command": "node",
      "args": ["dist/mcp-server-entry.js"],
      "cwd": "/path/to/graphxr-local-gateway"
    }
  }
}
```

## Data Model

```typescript
interface GNode { id: string; labels: string[]; properties: Record<string, unknown>; }
interface GEdge { id: string; type: string; startNodeId: string; endNodeId: string; properties: Record<string, unknown>; }
interface GraphSchema { categories: CategorySchema[]; relationships: RelationshipSchema[]; }
```

## API Endpoints

### Proxy API (graphxr-database-proxy compatible)
- `GET /api/providers` — List providers
- `POST /api/providers/:name/query` — Execute query
- `GET /api/providers/:name/graphSchema` — Graph schema

### Graph API (Bearer auth when enabled)
- `POST /graph/schema|neighbors|expand|query`

### Console API (localhost only, no auth)
- Providers CRUD: `GET|POST|PUT|DELETE /api/console/providers`
- Settings: `GET|PUT /api/console/settings`
- Tokens: `GET|POST|DELETE /api/console/tokens`
- SSE events: `GET /api/console/events/stream`
- Self-test: `POST /api/console/self-test`

## Console Pages (6)

- **Dashboard**: Stats, SSE events, provider health, self-test
- **Providers**: CRUD, template quick-setup, tool/event detail drawer
- **Sessions & Tokens**: Create/revoke tokens, pairing history
- **Graph Explorer**: Query editor, schema sidebar, params, history, export
- **Integration**: API docs, code examples (JS/cURL/Python/GraphXR), AI tool configs (Claude/Cursor/OpenCode), AI SDK examples (Anthropic/OpenAI)
- **Settings**: Auth toggle, CORS, token TTL, rate limiting

## Architecture

- **MCP-first**: Never use direct database drivers
- **Localhost only**: `127.0.0.1`, never `0.0.0.0`
- **Auth optional**: Disabled by default, enable in Settings
- **Dual mode**: HTTP gateway + stdio MCP server
- **Health monitoring**: 30s checks, auto-reconnect (up to 5 attempts)
- **Retry**: MCP tool calls retry 2x with exponential backoff

## Development Guidelines

- All database connections through MCP — never import direct drivers
- Keep bindings to `127.0.0.1` — security requirement
- Run `npm test` before committing
- Use `createTestApp()` / `getAuthToken()` patterns in tests
- Console is separate Vite project with own tsconfig/package.json
- Express 5: use `{*path}` for catch-all routes
