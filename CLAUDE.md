# CLAUDE.md — GraphXR Local Gateway

## Project Overview

GraphXR Local Gateway is a localhost-only HTTP service that bridges GraphXR Web (browser) to local/enterprise graph databases via MCP (Model Context Protocol). It binds to `127.0.0.1:19285` and provides a secure pairing-based auth flow.

## Tech Stack

- **Backend**: Node.js + Express 5, TypeScript, ESM modules
- **Frontend (Console)**: React 19 + Ant Design 5 + Vite 6, dark theme
- **Build**: `tsup` (backend), `vite` (console)
- **Test**: Vitest + Supertest
- **MCP SDK**: `@modelcontextprotocol/sdk`

## Project Structure

```
src/                        # Backend source (Express)
  index.ts                  # Entry point, config loading, server startup
  server.ts                 # Express app factory (middleware + routes)
  config/
    config-manager.ts       # Runtime config management + persistence
  middleware/                # cors, auth (bearer token), host-guard (DNS rebinding protection)
  routes/                   # health, pair, graph, catalog, console
  pairing/                  # PairingManager — session & token lifecycle
  mcp/                      # MCP client integration
    provider-registry.ts    # Provider registry interface
    mcp-manager.ts          # Manages MCP server connections (add/remove/restart at runtime)
    adapters/               # base-adapter, mcp-adapter, mock-adapter
  types/                    # config, graph-delta, api types
  utils/                    # logger, open-browser
console/                    # React frontend (Vite project)
  src/
    App.tsx                 # Layout + client-side routing (menu-based, no react-router)
    api.ts                  # API client (fetch wrappers)
    pages/                  # Dashboard, Providers, Sessions, GraphExplorer, Settings
    components/             # StatusBadge, ProviderModal
public/                     # Static assets served by Express
  console/                  # Vite build output (gitignored)
  pair-confirm.html         # Pairing confirmation page
tests/                      # Vitest test files
gateway.config.json         # Runtime config (providers, origins, etc.)
```

## Common Commands

```bash
# Development (both frontend + backend concurrently)
npm run dev

# Backend only (with tsx watch)
npm run dev:server

# Console frontend dev server (with HMR, proxies to backend)
npm run dev:web

# Build console to public/console/
npm run build:web

# Build backend to dist/
npm run build:server

# Run tests
npm test

# Start production
npm start
```

## Key Architecture Decisions

- **Localhost only**: Server binds to `127.0.0.1`, never `0.0.0.0`
- **Host guard middleware**: Rejects requests with unexpected `Host` headers (DNS rebinding protection)
- **Pairing auth**: Browser initiates pairing → user confirms locally → short-lived bearer token issued
- **Console is public**: `/console/*` and `/api/console/*` skip bearer auth (protected by host guard — local access only)
- **GraphDelta**: Unified response shape for all graph operations (`nodes[]`, `edges[]`, `pageInfo`, `summary`, `provenance`)
- **MCP adapters**: Each provider gets an adapter (real MCP or mock); the registry provides a unified interface
- **Dynamic CORS**: Origin allowlist is read from ConfigManager on each request, supports `["*"]` for allow-all
- **Runtime config**: Settings and providers can be managed at runtime via Console API, persisted to `gateway.config.json`

## Console API Endpoints

### Stats & Monitoring
- `GET /api/console/stats` — Dashboard stats (uptime, counts)
- `POST /api/console/self-test` — Run end-to-end health checks

### Sessions & Tokens
- `GET /api/console/sessions` — Pairing session history
- `GET /api/console/tokens` — Active tokens (prefix only)
- `DELETE /api/console/tokens/:prefix` — Revoke a token

### Provider Management (CRUD)
- `GET /api/console/providers` — Provider list with status
- `POST /api/console/providers` — Add new provider (connects MCP + persists)
- `PUT /api/console/providers/:name` — Update provider (reconnects)
- `DELETE /api/console/providers/:name` — Remove provider
- `POST /api/console/providers/:name/restart` — Restart provider connection

### Settings
- `GET /api/console/settings` — Current gateway config
- `PUT /api/console/settings` — Update allowedOrigins, tokenTTL, pairingTimeout

## Testing

Tests live in `tests/` and use Vitest. Run with `npm test`. Current coverage:
- `tests/middleware/cors.test.ts` — CORS middleware (including wildcard `*`)
- `tests/pairing/pairing-manager.test.ts` — Pairing lifecycle
- `tests/routes/health.test.ts` — Health endpoint + CORS integration
- `tests/routes/console-settings.test.ts` — Settings CRUD + persistence
- `tests/routes/console-providers.test.ts` — Provider CRUD validation
- `tests/routes/console-self-test.test.ts` — Self-test endpoint

## Config

`gateway.config.json` at project root. Key fields:
- `port` — Listen port (default 19285)
- `allowedOrigins` — CORS origin allowlist (default `["*"]` — allow all)
- `tokenTTL` — Bearer token lifetime in seconds (default 28800 = 8h)
- `pairingTimeout` — Pairing request timeout in seconds (default 300 = 5m)
- `providers[]` — MCP server definitions (name, transport, command, args, env, datasets)

All settings except `port` can be changed at runtime via the Console Settings page.
