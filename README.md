# GraphXR Local Gateway

A localhost-only HTTP service that bridges **GraphXR Web** (browser) to local/enterprise graph databases via **MCP** (Model Context Protocol).

## Features

- **MCP Bridge**: Connects to any MCP-compatible graph database (Neo4j, Spanner Graph, etc.) via stdio or HTTP transport
- **Multi-Provider**: Manage multiple data sources simultaneously through a unified API
- **Web Console**: Built-in dark-themed management UI at `http://127.0.0.1:19285/console`
- **Secure by Default**: Localhost-only binding, pairing-based auth, origin allowlist, DNS rebinding protection
- **Runtime Configuration**: Add/remove providers, update settings — all from the Console UI
- **Self-Test**: Built-in diagnostics to verify end-to-end connectivity

## Quick Start

```bash
# Install dependencies
npm install
cd console && npm install && cd ..

# Build the console frontend
npm run build:web

# Start in development mode (frontend HMR + backend watch)
npm run dev

# Or start in production mode
npm run build:server
npm start
```

Open `http://127.0.0.1:19285/console` in your browser.

## Console Pages

| Page | Description |
|------|-------------|
| **Dashboard** | Status overview, uptime, provider/token counts, self-test |
| **Providers** | Add, edit, delete, restart MCP providers |
| **Sessions & Tokens** | View pairing sessions, manage active bearer tokens |
| **Graph Explorer** | Interactive graph queries (neighbors, raw query) |
| **Settings** | Configure allowed origins, token TTL, pairing timeout |

## Adding a Provider

### Via Console UI
1. Go to **Providers** → **Add Provider**
2. Fill in: name, transport (stdio/http), command, args, datasets
3. Click OK — the gateway connects to the MCP server immediately

### Via Config File
Edit `gateway.config.json`:
```json
{
  "providers": [
    {
      "name": "my-neo4j",
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@neo4j/mcp-server"],
      "env": { "NEO4J_URI": "bolt://localhost:7687" },
      "datasets": ["movies"]
    }
  ]
}
```

## API Overview

### Graph Operations (require Bearer token)
```
POST /graph/schema       — Get graph schema
POST /graph/neighbors    — Fetch neighbor nodes
POST /graph/expand       — Multi-hop expansion
POST /graph/query        — Raw query (Cypher, GQL, SQL)
```

### Pairing Flow
```
POST /pair/start         — Initiate pairing from browser
GET  /pair/status        — Poll for approval
POST /pair/approve       — Local user approves (from confirm page)
```

### Console API (no auth, localhost only)
```
GET    /api/console/stats
GET    /api/console/settings
PUT    /api/console/settings
GET    /api/console/providers
POST   /api/console/providers
PUT    /api/console/providers/:name
DELETE /api/console/providers/:name
POST   /api/console/providers/:name/restart
POST   /api/console/self-test
```

## Self-Test

From the Dashboard, click **Run Test** to verify:
1. Gateway health status
2. Provider connectivity (all providers reachable)
3. Graph query (test schema retrieval from first connected provider)
4. CORS configuration

Or via API:
```bash
curl -X POST http://127.0.0.1:19285/api/console/self-test
```

## Security Model

- **Localhost only**: Binds to `127.0.0.1`, never `0.0.0.0`
- **Host guard**: Rejects requests with unexpected `Host` headers (DNS rebinding protection)
- **Pairing auth**: Browser initiates pairing → user confirms locally → short-lived bearer token issued
- **Origin binding**: Tokens are bound to the origin that initiated pairing
- **CORS allowlist**: Configurable, defaults to `["*"]` (allow all origins)
- **Console routes**: Skip bearer auth but are protected by host guard (local access only)

## Tech Stack

- **Backend**: Node.js, Express 5, TypeScript, ESM
- **Frontend**: React 19, Ant Design 5, Vite 6
- **MCP SDK**: `@modelcontextprotocol/sdk`
- **Tests**: Vitest + Supertest

## Development

```bash
npm run dev          # Concurrent frontend + backend dev
npm run dev:server   # Backend only (tsx watch)
npm run dev:web      # Frontend only (Vite HMR)
npm test             # Run tests
```

## License

TBD
