import { describe, it, expect, vi, beforeEach } from "vitest";
import { MCPAdapter } from "../../src/mcp/adapters/mcp-adapter.js";

// Create a mock MCP client
function createMockClient(toolResult: unknown) {
  return {
    callTool: vi.fn().mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(toolResult) }],
      isError: false,
    }),
    listTools: vi.fn().mockResolvedValue({ tools: [] }),
  } as any;
}

describe("MCPAdapter", () => {
  describe("Node normalization", () => {
    it("normalizes Neo4j-style nodes with labels[]", async () => {
      const client = createMockClient({
        nodes: [
          { id: "n1", labels: ["Person", "Actor"], properties: { name: "Alice", age: 30 } },
          { id: "n2", labels: ["Movie"], properties: { title: "Matrix" } },
        ],
        edges: [],
      });

      const adapter = new MCPAdapter("test", client, "neo4j", {
        query: "run_query",
        schema: "get_schema",
        neighbors: "get_neighbors",
        expand: "get_neighbors",
      });

      const result = await adapter.query("db", "MATCH (n) RETURN n", {});

      expect(result.nodes).toHaveLength(2);
      expect(result.nodes[0]).toEqual({
        id: "n1",
        labels: ["Person", "Actor"],
        properties: { name: "Alice", age: 30 },
      });
      expect(result.nodes[1]).toEqual({
        id: "n2",
        labels: ["Movie"],
        properties: { title: "Matrix" },
      });
    });

    it("normalizes nodes with single label field", async () => {
      const client = createMockClient({
        nodes: [
          { id: "s1", label: "Account", properties: { balance: 100 } },
        ],
        edges: [],
      });

      const adapter = new MCPAdapter("test", client, "spanner", {
        query: "execute_query",
        schema: "get_schema",
        neighbors: "get_neighbors",
        expand: "get_neighbors",
      });

      const result = await adapter.query("db", "SELECT *", {});

      expect(result.nodes[0].labels).toEqual(["Account"]);
    });

    it("normalizes nodes with type field (generic)", async () => {
      const client = createMockClient({
        nodes: [
          { id: "g1", type: "Server", properties: { host: "localhost" } },
        ],
        edges: [],
      });

      const adapter = new MCPAdapter("test", client, "generic", {
        query: "run_query",
        schema: "get_schema",
        neighbors: "get_neighbors",
        expand: "get_neighbors",
      });

      const result = await adapter.query("db", "query", {});

      expect(result.nodes[0].labels).toEqual(["Server"]);
    });

    it("handles nodes with props instead of properties", async () => {
      const client = createMockClient({
        nodes: [
          { id: "p1", labels: ["User"], props: { email: "test@example.com" } },
        ],
        edges: [],
      });

      const adapter = new MCPAdapter("test", client, "neo4j", {
        query: "run_query",
        schema: "get_schema",
        neighbors: "get_neighbors",
        expand: "get_neighbors",
      });

      const result = await adapter.query("db", "MATCH (n) RETURN n", {});

      expect(result.nodes[0].properties).toEqual({ email: "test@example.com" });
    });

    it("assigns Unknown label when no label/type info", async () => {
      const client = createMockClient({
        nodes: [{ id: "u1", properties: { x: 1 } }],
        edges: [],
      });

      const adapter = new MCPAdapter("test", client, "generic", {
        query: "run_query",
        schema: "get_schema",
        neighbors: "get_neighbors",
        expand: "get_neighbors",
      });

      const result = await adapter.query("db", "query", {});

      expect(result.nodes[0].labels).toEqual(["Unknown"]);
    });
  });

  describe("Edge normalization", () => {
    it("normalizes edges with startNodeId/endNodeId", async () => {
      const client = createMockClient({
        nodes: [],
        edges: [
          {
            id: "e1",
            type: "KNOWS",
            startNodeId: "n1",
            endNodeId: "n2",
            properties: { since: 2020 },
          },
        ],
      });

      const adapter = new MCPAdapter("test", client, "neo4j", {
        query: "run_query",
        schema: "get_schema",
        neighbors: "get_neighbors",
        expand: "get_neighbors",
      });

      const result = await adapter.query("db", "MATCH ()-[r]-() RETURN r", {});

      expect(result.edges).toHaveLength(1);
      expect(result.edges[0]).toEqual({
        id: "e1",
        type: "KNOWS",
        startNodeId: "n1",
        endNodeId: "n2",
        properties: { since: 2020 },
      });
    });

    it("normalizes edges with src/dst fields", async () => {
      const client = createMockClient({
        nodes: [],
        edges: [
          { id: "e2", type: "CONTAINS", src: "a", dst: "b", properties: {} },
        ],
      });

      const adapter = new MCPAdapter("test", client, "generic", {
        query: "run_query",
        schema: "get_schema",
        neighbors: "get_neighbors",
        expand: "get_neighbors",
      });

      const result = await adapter.query("db", "query", {});

      expect(result.edges[0].startNodeId).toBe("a");
      expect(result.edges[0].endNodeId).toBe("b");
    });

    it("normalizes edges with source/target fields", async () => {
      const client = createMockClient({
        nodes: [],
        edges: [
          { id: "e3", label: "LINKS_TO", source: "x", target: "y", data: { weight: 0.5 } },
        ],
      });

      const adapter = new MCPAdapter("test", client, "generic", {
        query: "run_query",
        schema: "get_schema",
        neighbors: "get_neighbors",
        expand: "get_neighbors",
      });

      const result = await adapter.query("db", "query", {});

      expect(result.edges[0].startNodeId).toBe("x");
      expect(result.edges[0].endNodeId).toBe("y");
      expect(result.edges[0].type).toBe("LINKS_TO");
      expect(result.edges[0].properties).toEqual({ weight: 0.5 });
    });

    it("generates edge ID from endpoints when none provided", async () => {
      const client = createMockClient({
        nodes: [],
        relationships: [
          { type: "FOLLOWS", from: "u1", to: "u2", properties: {} },
        ],
      });

      const adapter = new MCPAdapter("test", client, "generic", {
        query: "run_query",
        schema: "get_schema",
        neighbors: "get_neighbors",
        expand: "get_neighbors",
      });

      const result = await adapter.query("db", "query", {});

      expect(result.edges[0].id).toBe("u1-u2");
      expect(result.edges[0].startNodeId).toBe("u1");
      expect(result.edges[0].endNodeId).toBe("u2");
    });
  });

  describe("GraphDelta structure", () => {
    it("includes provenance information", async () => {
      const client = createMockClient({ nodes: [], edges: [] });

      const adapter = new MCPAdapter("my-provider", client, "neo4j", {
        query: "run_query",
        schema: "get_schema",
        neighbors: "get_neighbors",
        expand: "get_neighbors",
      });

      const result = await adapter.query("my-dataset", "MATCH (n) RETURN n", {});

      expect(result.provenance).toBeDefined();
      expect(result.provenance!.provider).toBe("my-provider");
      expect(result.provenance!.dataset).toBe("my-dataset");
      expect(result.provenance!.operation).toBe("query");
      expect(result.provenance!.timestamp).toBeTruthy();
    });

    it("includes summary with counts", async () => {
      const client = createMockClient({
        nodes: [
          { id: "1", labels: ["A"], properties: {} },
          { id: "2", labels: ["B"], properties: {} },
        ],
        edges: [
          { id: "e1", type: "R", startNodeId: "1", endNodeId: "2", properties: {} },
        ],
      });

      const adapter = new MCPAdapter("test", client, "neo4j", {
        query: "run_query",
        schema: "get_schema",
        neighbors: "get_neighbors",
        expand: "get_neighbors",
      });

      const result = await adapter.query("db", "MATCH (n)-[r]-() RETURN n, r", {});

      expect(result.summary).toBeDefined();
      expect(result.summary!.counts).toEqual({ nodes: 2, edges: 1 });
    });
  });

  describe("Schema normalization", () => {
    it("converts nodeTypes/edgeTypes to GraphSchema", async () => {
      const client = createMockClient({
        nodeTypes: [
          { name: "Person", propsTypes: { name: "string", age: "int" } },
          { name: "Movie", propsTypes: { title: "string" } },
        ],
        edgeTypes: [
          { name: "ACTED_IN", source: "Person", target: "Movie", propsTypes: { role: "string" } },
        ],
      });

      const adapter = new MCPAdapter("test", client, "neo4j", {
        query: "run_query",
        schema: "get_schema",
        neighbors: "get_neighbors",
        expand: "get_neighbors",
      });

      const schema = await adapter.getGraphSchema("db");

      expect(schema.categories).toHaveLength(2);
      expect(schema.categories[0].name).toBe("Person");
      expect(schema.relationships).toHaveLength(1);
      expect(schema.relationships[0].name).toBe("ACTED_IN");
      expect(schema.relationships[0].startCategory).toBe("Person");
      expect(schema.relationships[0].endCategory).toBe("Movie");
    });
  });

  describe("Nested data extraction", () => {
    it("extracts nodes from data.nodes shape", async () => {
      const client = createMockClient({
        data: {
          nodes: [{ id: "d1", labels: ["Item"], properties: { name: "test" } }],
          edges: [],
        },
      });

      const adapter = new MCPAdapter("test", client, "generic", {
        query: "run_query",
        schema: "get_schema",
        neighbors: "run_query",
        expand: "run_query",
      });

      const result = await adapter.query("db", "query", {});
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].id).toBe("d1");
    });

    it("extracts edges from relationships field", async () => {
      const client = createMockClient({
        nodes: [],
        relationships: [
          { id: "r1", type: "CONNECTS", startNodeId: "a", endNodeId: "b", properties: {} },
        ],
      });

      const adapter = new MCPAdapter("test", client, "neo4j", {
        query: "run_query",
        schema: "get_schema",
        neighbors: "run_query",
        expand: "run_query",
      });

      const result = await adapter.query("db", "query", {});
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].type).toBe("CONNECTS");
    });
  });

  describe("Query fallback", () => {
    it("uses query tool for neighbors when no dedicated tool exists", async () => {
      const client = createMockClient({ nodes: [], edges: [] });

      // Both neighbors and query map to the same tool = fallback
      const adapter = new MCPAdapter("test", client, "neo4j", {
        query: "read-cypher",
        schema: "get-schema",
        neighbors: "read-cypher",
        expand: "read-cypher",
      });

      await adapter.getNeighbors("db", "node-1", { limit: 10 });

      // Should have called with a generated Cypher query containing the nodeId
      expect(client.callTool).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "read-cypher",
          arguments: expect.objectContaining({
            query: expect.stringContaining("node-1"),
          }),
        })
      );
    });

    it("generates Cypher for Neo4j expand fallback", async () => {
      const client = createMockClient({ nodes: [], edges: [] });

      const adapter = new MCPAdapter("test", client, "neo4j", {
        query: "read-cypher",
        schema: "get-schema",
        neighbors: "read-cypher",
        expand: "read-cypher",
      });

      await adapter.expand("db", ["id1", "id2"], { depth: 2, limit: 50 });

      expect(client.callTool).toHaveBeenCalledWith(
        expect.objectContaining({
          arguments: expect.objectContaining({
            query: expect.stringMatching(/IN \[.*'id1'.*'id2'/),
          }),
        })
      );
    });
  });

  describe("Error handling", () => {
    it("throws on MCP-level error response", async () => {
      const client = {
        callTool: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "Database unavailable" }],
          isError: true,
        }),
      } as any;

      const adapter = new MCPAdapter("test", client, "neo4j", {
        query: "run_query",
        schema: "get_schema",
        neighbors: "get_neighbors",
        expand: "get_neighbors",
      });

      await expect(adapter.query("db", "MATCH (n) RETURN n", {})).rejects.toThrow(
        /returned error/
      );
    });

    it("throws on connection failure after retries", async () => {
      const client = {
        callTool: vi.fn().mockRejectedValue(new Error("Connection refused")),
      } as any;

      const adapter = new MCPAdapter("test", client, "neo4j", {
        query: "run_query",
        schema: "get_schema",
        neighbors: "get_neighbors",
        expand: "get_neighbors",
      });

      await expect(adapter.query("db", "MATCH (n) RETURN n", {})).rejects.toThrow(
        /failed after retries/
      );
    }, 10_000);
  });
});
