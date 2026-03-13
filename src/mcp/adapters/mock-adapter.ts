import type { GraphDelta, GraphSchema } from "../../types/graph-delta.js";
import type {
  BaseAdapter,
  NeighborsOptions,
  ExpandOptions,
  QueryOptions,
} from "./base-adapter.js";

/**
 * Mock adapter — returns hardcoded graph data for testing
 * the end-to-end flow without a real MCP server.
 * Data format matches graphxr-database-proxy conventions.
 */
export class MockAdapter implements BaseAdapter {
  readonly providerName = "mock";

  async getSchema(_dataset: string): Promise<GraphDelta> {
    return {
      nodes: [
        {
          id: "type:Person",
          labels: ["NodeType"],
          properties: { name: "Person", props: ["name", "age"] },
        },
        {
          id: "type:Company",
          labels: ["NodeType"],
          properties: { name: "Company", props: ["name", "founded"] },
        },
      ],
      edges: [
        {
          id: "rel:WORKS_AT",
          type: "EdgeType",
          startNodeId: "type:Person",
          endNodeId: "type:Company",
          properties: { name: "WORKS_AT" },
        },
      ],
      provenance: {
        provider: "mock",
        dataset: _dataset,
        operation: "schema",
        timestamp: new Date().toISOString(),
      },
    };
  }

  async getGraphSchema(_dataset: string): Promise<GraphSchema> {
    return {
      categories: [
        {
          name: "Person",
          props: ["name", "age"],
          keys: ["name"],
          keysTypes: { name: "STRING" },
          propsTypes: { name: "STRING", age: "INT64" },
        },
        {
          name: "Company",
          props: ["name", "founded"],
          keys: ["name"],
          keysTypes: { name: "STRING" },
          propsTypes: { name: "STRING", founded: "INT64" },
        },
      ],
      relationships: [
        {
          name: "WORKS_AT",
          props: ["role", "since"],
          keys: [],
          keysTypes: {},
          propsTypes: { role: "STRING", since: "INT64" },
          startCategory: "Person",
          endCategory: "Company",
        },
        {
          name: "KNOWS",
          props: ["since"],
          keys: [],
          keysTypes: {},
          propsTypes: { since: "INT64" },
          startCategory: "Person",
          endCategory: "Person",
        },
      ],
    };
  }

  async getNeighbors(
    dataset: string,
    nodeId: string,
    opts: NeighborsOptions
  ): Promise<GraphDelta> {
    const limit = opts.limit ?? 10;
    const nodes = [
      { id: nodeId, labels: ["Person"], properties: { name: "Alice", age: 30 } },
      { id: "node-2", labels: ["Person"], properties: { name: "Bob", age: 25 } },
      { id: "node-3", labels: ["Company"], properties: { name: "Kineviz", founded: 2016 } },
    ];
    const edges = [
      { id: "edge-1", type: "KNOWS", startNodeId: nodeId, endNodeId: "node-2", properties: { since: 2020 } },
      { id: "edge-2", type: "WORKS_AT", startNodeId: nodeId, endNodeId: "node-3", properties: { role: "Engineer" } },
    ];

    return {
      nodes: nodes.slice(0, limit),
      edges: edges.slice(0, limit),
      pageInfo: { hasMore: false },
      summary: { truncated: false, counts: { nodes: nodes.length, edges: edges.length } },
      provenance: { provider: "mock", dataset, operation: "neighbors", timestamp: new Date().toISOString() },
    };
  }

  async expand(
    dataset: string,
    nodeIds: string[],
    opts: ExpandOptions
  ): Promise<GraphDelta> {
    const limit = opts.limit ?? 50;
    const nodes = [
      { id: nodeIds[0], labels: ["Person"], properties: { name: "Alice", age: 30 } },
      { id: "node-2", labels: ["Person"], properties: { name: "Bob", age: 25 } },
      { id: "node-3", labels: ["Company"], properties: { name: "Kineviz", founded: 2016 } },
      { id: "node-4", labels: ["Person"], properties: { name: "Charlie", age: 35 } },
    ];
    const edges = [
      { id: "edge-1", type: "KNOWS", startNodeId: nodeIds[0], endNodeId: "node-2", properties: {} },
      { id: "edge-2", type: "WORKS_AT", startNodeId: nodeIds[0], endNodeId: "node-3", properties: {} },
      { id: "edge-3", type: "KNOWS", startNodeId: "node-2", endNodeId: "node-4", properties: {} },
    ];

    return {
      nodes: nodes.slice(0, limit),
      edges: edges.slice(0, limit),
      pageInfo: { hasMore: false },
      summary: { truncated: false, counts: { nodes: nodes.length, edges: edges.length } },
      provenance: { provider: "mock", dataset, operation: "expand", timestamp: new Date().toISOString() },
    };
  }

  async query(
    dataset: string,
    _query: string,
    opts: QueryOptions
  ): Promise<GraphDelta> {
    const limit = opts.limit ?? 100;
    const nodes = [
      { id: "q-node-1", labels: ["Person"], properties: { name: "Alice", age: 30 } },
      { id: "q-node-2", labels: ["Company"], properties: { name: "Kineviz", founded: 2016 } },
    ];
    const edges = [
      { id: "q-edge-1", type: "WORKS_AT", startNodeId: "q-node-1", endNodeId: "q-node-2", properties: { role: "Engineer" } },
    ];

    return {
      nodes: nodes.slice(0, limit),
      edges: edges.slice(0, limit),
      pageInfo: { hasMore: false },
      summary: { truncated: false, counts: { nodes: nodes.length, edges: edges.length } },
      provenance: { provider: "mock", dataset, operation: "query", timestamp: new Date().toISOString() },
    };
  }
}
