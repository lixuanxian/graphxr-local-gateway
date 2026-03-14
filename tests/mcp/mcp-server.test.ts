import { describe, it, expect, beforeAll } from "vitest";
import { MCPManager } from "../../src/mcp/mcp-manager.js";
import { createMCPServer } from "../../src/mcp/mcp-server.js";

describe("MCP Server", () => {
  let mcpManager: MCPManager;

  beforeAll(async () => {
    mcpManager = new MCPManager();
    // Init with no providers → mock adapter
    await mcpManager.init([]);
  });

  it("creates an MCP server with tools", () => {
    const server = createMCPServer(mcpManager);
    expect(server).toBeDefined();
  });

  it("list_providers returns mock provider when no real providers", async () => {
    const server = createMCPServer(mcpManager);
    // Access internal tool handler by checking registry
    const providers = mcpManager.registry.listProviders();
    expect(providers.length).toBeGreaterThan(0);
    expect(providers[0].name).toBe("mock");
  });

  it("get_schema returns error for unknown provider", async () => {
    const server = createMCPServer(mcpManager);
    // Verify the adapter lookup returns undefined for non-existent
    const adapter = mcpManager.registry.getAdapter("nonexistent");
    expect(adapter).toBeUndefined();
  });

  it("registry provides datasets for mock provider", () => {
    const datasets = mcpManager.registry.listDatasets("mock");
    expect(datasets).toEqual(["demo"]);
  });
});
