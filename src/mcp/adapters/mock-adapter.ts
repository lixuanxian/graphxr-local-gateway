import type { GraphDelta } from "../../types/graph-delta.js";
import type {
  BaseAdapter,
  NeighborsOptions,
  ExpandOptions,
  QueryOptions,
} from "./base-adapter.js";

/**
 * Mock adapter for Phase 0 — returns hardcoded graph data
 * for testing the end-to-end flow.
 */
export class MockAdapter implements BaseAdapter {
  readonly providerName = "mock";

  async getSchema(_dataset: string): Promise<GraphDelta> {
    return {
      nodes: [
        { id: "type:Person", type: "NodeType", props: { name: "Person", properties: ["name", "age"] } },
        { id: "type:Company", type: "NodeType", props: { name: "Company", properties: ["name", "founded"] } },
      ],
      edges: [
        { id: "rel:WORKS_AT", src: "type:Person", dst: "type:Company", type: "EdgeType", props: { name: "WORKS_AT" } },
      ],
      provenance: { provider: "mock", dataset: _dataset, tool: "schema", timestamp: new Date().toISOString() },
    };
  }

  async getNeighbors(
    dataset: string,
    nodeId: string,
    opts: NeighborsOptions
  ): Promise<GraphDelta> {
    const limit = opts.limit ?? 10;
    const nodes = [
      { id: nodeId, type: "Person", props: { name: "Alice", age: 30 } },
      { id: "node-2", type: "Person", props: { name: "Bob", age: 25 } },
      { id: "node-3", type: "Company", props: { name: "Kineviz", founded: 2016 } },
    ];
    const edges = [
      { id: "edge-1", src: nodeId, dst: "node-2", type: "KNOWS", props: { since: 2020 } },
      { id: "edge-2", src: nodeId, dst: "node-3", type: "WORKS_AT", props: { role: "Engineer" } },
    ];

    return {
      nodes: nodes.slice(0, limit),
      edges: edges.slice(0, limit),
      pageInfo: { hasMore: false },
      summary: { truncated: false, counts: { nodes: nodes.length, edges: edges.length } },
      provenance: { provider: "mock", dataset, tool: "neighbors", timestamp: new Date().toISOString() },
    };
  }

  async expand(
    dataset: string,
    nodeIds: string[],
    opts: ExpandOptions
  ): Promise<GraphDelta> {
    const limit = opts.limit ?? 50;
    const nodes = [
      { id: nodeIds[0], type: "Person", props: { name: "Alice", age: 30 } },
      { id: "node-2", type: "Person", props: { name: "Bob", age: 25 } },
      { id: "node-3", type: "Company", props: { name: "Kineviz", founded: 2016 } },
      { id: "node-4", type: "Person", props: { name: "Charlie", age: 35 } },
    ];
    const edges = [
      { id: "edge-1", src: nodeIds[0], dst: "node-2", type: "KNOWS", props: {} },
      { id: "edge-2", src: nodeIds[0], dst: "node-3", type: "WORKS_AT", props: {} },
      { id: "edge-3", src: "node-2", dst: "node-4", type: "KNOWS", props: {} },
    ];

    return {
      nodes: nodes.slice(0, limit),
      edges: edges.slice(0, limit),
      pageInfo: { hasMore: false },
      summary: { truncated: false, counts: { nodes: nodes.length, edges: edges.length } },
      provenance: { provider: "mock", dataset, tool: "expand", timestamp: new Date().toISOString() },
    };
  }

  async query(
    dataset: string,
    _query: string,
    opts: QueryOptions
  ): Promise<GraphDelta> {
    const limit = opts.limit ?? 100;
    const nodes = [
      { id: "q-node-1", type: "Person", props: { name: "Alice", age: 30 } },
      { id: "q-node-2", type: "Company", props: { name: "Kineviz", founded: 2016 } },
    ];
    const edges = [
      { id: "q-edge-1", src: "q-node-1", dst: "q-node-2", type: "WORKS_AT", props: { role: "Engineer" } },
    ];

    return {
      nodes: nodes.slice(0, limit),
      edges: edges.slice(0, limit),
      pageInfo: { hasMore: false },
      summary: { truncated: false, counts: { nodes: nodes.length, edges: edges.length } },
      provenance: { provider: "mock", dataset, tool: "query", timestamp: new Date().toISOString() },
    };
  }
}
