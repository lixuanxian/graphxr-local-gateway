# GraphXR Local Gateway

A localhost-only service that bridges **GraphXR Web**, **AI coding tools**, and **custom apps** to graph databases via **MCP** (Model Context Protocol).

## Features

- **MCP Bridge**: Connects to any MCP-compatible graph database (Neo4j, Spanner Graph, Memgraph, etc.) via stdio or HTTP transport
- **MCP Server Mode**: Exposes graph tools to AI coding tools (Claude Desktop, Claude Code, Cursor, OpenCode) via stdio
- **Multi-Provider**: Manage multiple data sources simultaneously through a unified API
- **Web Console**: Built-in dark-themed management UI with 6 pages (Dashboard, Providers, Sessions, Graph Explorer, Integration, Settings)
- **AI Integration**: Use as tool backend for Claude, OpenAI, or any LLM framework
- **Secure by Default**: Localhost-only binding, optional pairing-based auth, origin allowlist, DNS rebinding protection
- **Runtime Configuration**: Add/remove providers, update settings — all from the Console UI

## Quick Start

```bash
# Install dependencies
npm install
cd console && npm install && cd ..

# Build
npm run build:web    # Console frontend
npm run build:server # Backend

# Start HTTP gateway + console
npm start
# → http://127.0.0.1:19285/console

# Or development mode (HMR)
npm run dev
```

## Use with AI Tools (MCP Server Mode)

The gateway can run as an MCP server, letting AI tools query your graph databases directly.

### Claude Code

```bash
claude mcp add graphxr-gateway node dist/mcp-server-entry.js
```

Or add `.mcp.json` to your project root:

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

### Claude Desktop

Add to `claude_desktop_config.json`:

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

### Cursor

Add `.cursor/mcp.json` to your project:

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

### OpenCode

Add to `opencode.json`:

```json
{
  "mcp": {
    "graphxr-gateway": {
      "type": "stdio",
      "command": "node",
      "args": ["dist/mcp-server-entry.js"],
      "cwd": "/path/to/graphxr-local-gateway"
    }
  }
}
```

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `list_providers` | List all connected graph database providers |
| `get_schema` | Get graph schema (node categories + relationship types) |
| `query_graph` | Execute Cypher/GQL/SQL queries, returns nodes + edges |
| `get_neighbors` | Get nodes connected to a specific node |

## Adding a Provider

### Via Console UI
1. Go to **Providers** → **Add Provider**
2. Select a template (Neo4j, Spanner, etc.) or configure manually
3. Fill in: name, transport, command/endpoint, env vars, datasets
4. Click OK — the gateway connects to the MCP server immediately

### Via Config File
Edit `gateway.config.json`:
```json
{
  "providers": [
    {
      "name": "my-neo4j",
      "transport": "stdio",
      "databaseType": "neo4j",
      "command": "npx",
      "args": ["-y", "@neo4j/mcp-server"],
      "env": {
        "NEO4J_URI": "bolt://localhost:7687",
        "NEO4J_USERNAME": "neo4j",
        "NEO4J_PASSWORD": "password"
      },
      "datasets": ["movies"]
    }
  ]
}
```

## Console Pages

| Page | Description |
|------|-------------|
| **Dashboard** | Status overview, real-time SSE events, provider health, self-test |
| **Providers** | CRUD table, template quick-setup, tool/event/config detail drawer |
| **Sessions & Tokens** | Token management (create, revoke), pairing history |
| **Graph Explorer** | Query editor with schema sidebar, params, history, export |
| **Integration** | API docs, code examples, AI tool configs |
| **Settings** | Auth toggle, CORS, token TTL, rate limiting |

## API Overview

### Proxy-Compatible API (matches graphxr-database-proxy)
```
GET  /api/providers                       — List all providers
GET  /api/providers/:name/graphSchema     — Graph schema
POST /api/providers/:name/query           — Execute query
```

### Graph Operations (Bearer token when auth enabled)
```
POST /graph/schema       — Get graph schema
POST /graph/neighbors    — Fetch neighbor nodes
POST /graph/expand       — Multi-hop expansion
POST /graph/query        — Raw query (Cypher, GQL, SQL)
```

### Console API (no auth, localhost only)
```
GET/PUT  /api/console/settings
GET/POST /api/console/providers
POST     /api/console/providers/:name/restart
POST     /api/console/providers/:name/test-query
POST     /api/console/self-test
GET      /api/console/events/stream          — SSE real-time events
```

## Security Model

- **Localhost only**: Binds to `127.0.0.1`, never `0.0.0.0`
- **Auth optional**: Bearer token auth disabled by default, enable in Settings
- **Host guard**: DNS rebinding protection on all routes
- **CORS allowlist**: Configurable, defaults to `["*"]`
- **Rate limiting**: Optional per-IP rate limiting

## Tech Stack

- **Backend**: Node.js, Express 5, TypeScript, ESM
- **Frontend**: React 19, Ant Design 5, Vite 6
- **MCP SDK**: `@modelcontextprotocol/sdk` (client + server)
- **Tests**: Vitest + Supertest (105 tests across 14 files)

## Development

```bash
npm run dev          # Concurrent frontend + backend dev
npm run dev:server   # Backend only (tsx watch)
npm run dev:web      # Frontend only (Vite HMR)
npm test             # Run all tests
npm run start:mcp    # Run MCP server mode only
```

## License

TBD
