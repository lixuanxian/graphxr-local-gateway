import { useEffect, useState } from "react";
import {
  Card,
  Select,
  Input,
  Button,
  Typography,
  Tabs,
  Space,
  InputNumber,
  Spin,
  Alert,
  Table,
  Tag,
  Tooltip,
  Descriptions,
  Segmented,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  SendOutlined,
  NodeIndexOutlined,
  BranchesOutlined,
  CodeOutlined,
} from "@ant-design/icons";
import {
  getProviders,
  consoleTestQuery,
  type ProviderInfo,
} from "../api.ts";

interface GNode {
  id: string;
  labels?: string[];
  type?: string;
  properties?: Record<string, unknown>;
}

interface GEdge {
  id: string;
  type?: string;
  startNodeId?: string;
  endNodeId?: string;
  properties?: Record<string, unknown>;
}

interface GraphResult {
  nodes?: GNode[];
  edges?: GEdge[];
  summary?: {
    counts?: { nodes: number; edges: number };
    executionTime?: number;
  };
  provenance?: {
    provider: string;
    dataset: string;
    operation: string;
  };
}

type ViewMode = "table" | "json";

const NODE_COLUMNS: ColumnsType<GNode> = [
  {
    title: "ID",
    dataIndex: "id",
    key: "id",
    width: 200,
    ellipsis: true,
    render: (id: string) => (
      <Typography.Text code copyable={{ text: id }}>
        {id.length > 24 ? id.slice(0, 24) + "..." : id}
      </Typography.Text>
    ),
  },
  {
    title: "Labels",
    key: "labels",
    width: 200,
    render: (_, node) => {
      const labels = node.labels ?? (node.type ? [node.type] : []);
      return labels.map((l) => (
        <Tag key={l} color="blue">
          {l}
        </Tag>
      ));
    },
  },
  {
    title: "Properties",
    key: "properties",
    render: (_, node) => {
      const props = node.properties ?? {};
      const keys = Object.keys(props);
      if (keys.length === 0) return <Typography.Text type="secondary">-</Typography.Text>;
      const display = keys.slice(0, 4);
      return (
        <Space size={4} wrap>
          {display.map((k) => (
            <Tooltip key={k} title={`${k}: ${JSON.stringify(props[k])}`}>
              <Tag>
                {k}: {truncateValue(props[k])}
              </Tag>
            </Tooltip>
          ))}
          {keys.length > 4 && (
            <Typography.Text type="secondary">+{keys.length - 4} more</Typography.Text>
          )}
        </Space>
      );
    },
  },
];

const EDGE_COLUMNS: ColumnsType<GEdge> = [
  {
    title: "ID",
    dataIndex: "id",
    key: "id",
    width: 160,
    ellipsis: true,
    render: (id: string) => (
      <Typography.Text code>
        {id.length > 20 ? id.slice(0, 20) + "..." : id}
      </Typography.Text>
    ),
  },
  {
    title: "Type",
    dataIndex: "type",
    key: "type",
    width: 140,
    render: (t: string) => t ? <Tag color="orange">{t}</Tag> : "-",
  },
  {
    title: "Start Node",
    dataIndex: "startNodeId",
    key: "startNodeId",
    width: 200,
    ellipsis: true,
    render: (id: string) =>
      id ? (
        <Typography.Text code>
          {id.length > 20 ? id.slice(0, 20) + "..." : id}
        </Typography.Text>
      ) : (
        "-"
      ),
  },
  {
    title: "End Node",
    dataIndex: "endNodeId",
    key: "endNodeId",
    width: 200,
    ellipsis: true,
    render: (id: string) =>
      id ? (
        <Typography.Text code>
          {id.length > 20 ? id.slice(0, 20) + "..." : id}
        </Typography.Text>
      ) : (
        "-"
      ),
  },
  {
    title: "Properties",
    key: "properties",
    render: (_, edge) => {
      const props = edge.properties ?? {};
      const keys = Object.keys(props);
      if (keys.length === 0) return <Typography.Text type="secondary">-</Typography.Text>;
      const display = keys.slice(0, 3);
      return (
        <Space size={4} wrap>
          {display.map((k) => (
            <Tooltip key={k} title={`${k}: ${JSON.stringify(props[k])}`}>
              <Tag>
                {k}: {truncateValue(props[k])}
              </Tag>
            </Tooltip>
          ))}
          {keys.length > 3 && (
            <Typography.Text type="secondary">+{keys.length - 3} more</Typography.Text>
          )}
        </Space>
      );
    },
  },
];

function truncateValue(v: unknown): string {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 30 ? s.slice(0, 30) + "..." : s;
}

export default function GraphExplorer() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [provider, setProvider] = useState<string>("");
  const [dataset, setDataset] = useState<string>("");
  const [datasets, setDatasets] = useState<string[]>([]);

  // Neighbors tab
  const [nodeId, setNodeId] = useState("node-1");
  const [limit, setLimit] = useState(10);

  // Query tab
  const [queryStr, setQueryStr] = useState("");

  const [result, setResult] = useState<GraphResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  useEffect(() => {
    getProviders().then((ps) => {
      setProviders(ps);
      if (ps.length > 0) {
        setProvider(ps[0].name);
        setDatasets(ps[0].datasets);
        if (ps[0].datasets.length > 0) setDataset(ps[0].datasets[0]);
      }
    });
  }, []);

  const handleProviderChange = (name: string) => {
    setProvider(name);
    const p = providers.find((x) => x.name === name);
    const ds = p?.datasets ?? [];
    setDatasets(ds);
    setDataset(ds[0] ?? "");
  };

  const selectedProvider = providers.find((p) => p.name === provider);

  const runNeighbors = async () => {
    setLoading(true);
    setError(null);
    try {
      // Use console test-query endpoint to generate a neighbors query
      const dbType = selectedProvider?.databaseType ?? "generic";
      const q = dbType === "neo4j" || dbType === "memgraph"
        ? `MATCH (n)-[r]-(m) WHERE n.id = '${nodeId}' OR id(n) = ${/^\d+$/.test(nodeId) ? nodeId : `'${nodeId}'`} RETURN n, r, m LIMIT ${limit}`
        : `MATCH (n)-[r]-(m) WHERE n.id = '${nodeId}' RETURN n, r, m LIMIT ${limit}`;
      const res = await consoleTestQuery(provider, { dataset, query: q, limit });
      setResult(res.data ?? res);
    } catch (e: any) {
      setError(e.message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const runQuery = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await consoleTestQuery(provider, { dataset, query: queryStr, limit });
      setResult(res.data ?? res);
    } catch (e: any) {
      setError(e.message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const nodes = result?.nodes ?? [];
  const edges = result?.edges ?? [];
  const counts = result?.summary?.counts;

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 24 }}>
        Graph Explorer
      </Typography.Title>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <span>Provider:</span>
          <Select
            value={provider}
            onChange={handleProviderChange}
            style={{ width: 180 }}
            options={providers.map((p) => ({
              value: p.name,
              label: (
                <Space>
                  {p.name}
                  <Tag
                    color={p.status === "connected" ? "green" : "red"}
                    style={{ marginLeft: 4, fontSize: 10 }}
                  >
                    {p.databaseType}
                  </Tag>
                </Space>
              ),
            }))}
          />
          <span>Dataset:</span>
          <Select
            value={dataset}
            onChange={setDataset}
            style={{ width: 160 }}
            options={datasets.map((d) => ({ value: d, label: d }))}
          />
          <span>Limit:</span>
          <InputNumber
            value={limit}
            onChange={(v) => setLimit(v ?? 10)}
            min={1}
            max={500}
            style={{ width: 80 }}
          />
          {selectedProvider && (
            <Tag color={selectedProvider.status === "connected" ? "green" : "red"}>
              {selectedProvider.status}
            </Tag>
          )}
        </Space>
      </Card>

      <Tabs
        items={[
          {
            key: "neighbors",
            label: "Neighbors",
            children: (
              <Space.Compact style={{ width: "100%" }}>
                <Input
                  placeholder="Node ID"
                  value={nodeId}
                  onChange={(e) => setNodeId(e.target.value)}
                  onPressEnter={runNeighbors}
                  style={{ flex: 1 }}
                />
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={runNeighbors}
                  loading={loading}
                >
                  Fetch
                </Button>
              </Space.Compact>
            ),
          },
          {
            key: "query",
            label: "Raw Query",
            children: (
              <Space direction="vertical" style={{ width: "100%" }}>
                <Input.TextArea
                  rows={3}
                  placeholder={getQueryPlaceholder(selectedProvider?.databaseType)}
                  value={queryStr}
                  onChange={(e) => setQueryStr(e.target.value)}
                />
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={runQuery}
                  loading={loading}
                >
                  Execute
                </Button>
              </Space>
            ),
          },
        ]}
      />

      {error && (
        <Alert
          type="error"
          message={error}
          style={{ marginTop: 16 }}
          closable
          onClose={() => setError(null)}
        />
      )}

      {result && (
        <div style={{ marginTop: 16 }}>
          {/* Result summary bar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <Space>
              <Typography.Text strong>Results</Typography.Text>
              {counts && (
                <Space size={8}>
                  <Tag icon={<NodeIndexOutlined />} color="blue">
                    {counts.nodes} nodes
                  </Tag>
                  <Tag icon={<BranchesOutlined />} color="orange">
                    {counts.edges} edges
                  </Tag>
                </Space>
              )}
              {result.summary?.executionTime != null && (
                <Typography.Text type="secondary">
                  {result.summary.executionTime}ms
                </Typography.Text>
              )}
              {result.provenance && (
                <Typography.Text type="secondary">
                  via {result.provenance.provider}/{result.provenance.dataset}
                </Typography.Text>
              )}
            </Space>
            <Segmented
              size="small"
              value={viewMode}
              onChange={(v) => setViewMode(v as ViewMode)}
              options={[
                { value: "table", icon: <NodeIndexOutlined /> },
                { value: "json", icon: <CodeOutlined /> },
              ]}
            />
          </div>

          {viewMode === "table" ? (
            <>
              {/* Nodes table */}
              {nodes.length > 0 && (
                <Card
                  size="small"
                  title={
                    <Space>
                      <NodeIndexOutlined />
                      <span>Nodes ({nodes.length})</span>
                    </Space>
                  }
                  style={{ marginBottom: 12 }}
                >
                  <Table
                    columns={NODE_COLUMNS}
                    dataSource={nodes}
                    rowKey="id"
                    pagination={nodes.length > 20 ? { pageSize: 20 } : false}
                    size="small"
                    scroll={{ x: 600 }}
                  />
                </Card>
              )}

              {/* Edges table */}
              {edges.length > 0 && (
                <Card
                  size="small"
                  title={
                    <Space>
                      <BranchesOutlined />
                      <span>Edges ({edges.length})</span>
                    </Space>
                  }
                >
                  <Table
                    columns={EDGE_COLUMNS}
                    dataSource={edges}
                    rowKey="id"
                    pagination={edges.length > 20 ? { pageSize: 20 } : false}
                    size="small"
                    scroll={{ x: 800 }}
                  />
                </Card>
              )}

              {nodes.length === 0 && edges.length === 0 && (
                <Alert
                  type="info"
                  message="Query returned no graph data"
                  description="The query executed successfully but returned no nodes or edges."
                />
              )}
            </>
          ) : (
            <Card size="small">
              <pre
                style={{
                  background: "#12141c",
                  padding: 16,
                  borderRadius: 8,
                  overflow: "auto",
                  maxHeight: 500,
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: "#e0e0e0",
                  margin: 0,
                }}
              >
                {JSON.stringify(result, null, 2)}
              </pre>
            </Card>
          )}
        </div>
      )}

      {loading && !result && (
        <Spin style={{ display: "block", marginTop: 32 }} />
      )}
    </div>
  );
}

function getQueryPlaceholder(dbType?: string): string {
  switch (dbType) {
    case "neo4j":
    case "memgraph":
      return "MATCH (n) RETURN n LIMIT 25";
    case "spanner":
      return "SELECT * FROM GRAPH_TABLE(MyGraph MATCH (n) RETURN n.id, LABELS(n)) LIMIT 25";
    default:
      return "Enter query (Cypher, GQL, SQL...)";
  }
}
