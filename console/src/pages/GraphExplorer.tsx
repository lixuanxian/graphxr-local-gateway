import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card,
  Select,
  Input,
  Button,
  Typography,
  Space,
  InputNumber,
  Spin,
  Alert,
  Table,
  Tag,
  Tooltip,
  Segmented,
  Collapse,
  Empty,
  Dropdown,
  Badge,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  SendOutlined,
  NodeIndexOutlined,
  BranchesOutlined,
  CodeOutlined,
  HistoryOutlined,
  DownloadOutlined,
  CopyOutlined,
  ThunderboltOutlined,
  DatabaseOutlined,
  ExpandOutlined,
  PlusOutlined,
  DeleteOutlined,
  MinusCircleOutlined,
} from "@ant-design/icons";
import {
  getProviders,
  getProviderSchema,
  consoleTestQuery,
  type ProviderInfo,
  type GraphSchema,
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

interface QueryHistoryEntry {
  query: string;
  provider: string;
  dataset: string;
  timestamp: number;
  nodeCount: number;
  edgeCount: number;
  executionTime?: number;
}

type ViewMode = "table" | "json";

const HISTORY_KEY = "graphxr-query-history";
const MAX_HISTORY = 20;

function loadHistory(): QueryHistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveHistory(entries: QueryHistoryEntry[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
}

function getExampleQueries(dbType?: string, schema?: GraphSchema | null): { label: string; query: string }[] {
  const categories = schema?.categories?.map((c) => c.name) ?? [];
  const relationships = schema?.relationships ?? [];
  const cat1 = categories[0] ?? "Node";
  const cat2 = categories[1] ?? categories[0] ?? "Node";
  const rel1 = relationships[0]?.type ?? "RELATES_TO";

  switch (dbType) {
    case "neo4j":
    case "memgraph":
      return [
        { label: "All nodes (limit 25)", query: "MATCH (n) RETURN n LIMIT 25" },
        { label: "All relationships", query: "MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 25" },
        { label: `All ${cat1} nodes`, query: `MATCH (n:${cat1}) RETURN n LIMIT 25` },
        { label: `${cat1} -> ${cat2}`, query: `MATCH (a:${cat1})-[r:${rel1}]->(b:${cat2}) RETURN a, r, b LIMIT 25` },
        { label: "Count by label", query: "MATCH (n) RETURN labels(n) AS label, count(n) AS count ORDER BY count DESC" },
        { label: "Shortest path", query: `MATCH p=shortestPath((a:${cat1})-[*]-(b:${cat2})) RETURN p LIMIT 5` },
      ];
    case "spanner":
      return [
        { label: "All nodes (limit 25)", query: `GRAPH FinGraph MATCH (n) RETURN n.id, LABELS(n) AS label LIMIT 25` },
        { label: "All relationships", query: `GRAPH FinGraph MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 25` },
        { label: `All ${cat1} nodes`, query: `GRAPH FinGraph MATCH (n:${cat1}) RETURN n LIMIT 25` },
        { label: "Count by label", query: `GRAPH FinGraph MATCH (n) RETURN LABELS(n) AS label, COUNT(*) AS cnt GROUP BY label` },
      ];
    default:
      return [
        { label: "All nodes (limit 25)", query: "MATCH (n) RETURN n LIMIT 25" },
        { label: "All relationships", query: "MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 25" },
        { label: `All ${cat1} nodes`, query: `MATCH (n:${cat1}) RETURN n LIMIT 25` },
      ];
  }
}

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

  const [schema, setSchema] = useState<GraphSchema | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);

  const [queryStr, setQueryStr] = useState("");
  const [limit, setLimit] = useState(25);

  const [result, setResult] = useState<GraphResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  const [history, setHistory] = useState<QueryHistoryEntry[]>(loadHistory);
  const [params, setParams] = useState<Array<{ key: string; value: string }>>([]);
  const [showParams, setShowParams] = useState(false);

  const activeParamCount = params.filter((p) => p.key.trim()).length;

  const selectedProvider = providers.find((p) => p.name === provider);

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
    setSchema(null);
  };

  // Load schema when provider/dataset changes
  useEffect(() => {
    if (!provider || !dataset) return;
    setSchemaLoading(true);
    getProviderSchema(provider, dataset)
      .then((r) => setSchema(r.schema))
      .catch(() => setSchema(null))
      .finally(() => setSchemaLoading(false));
  }, [provider, dataset]);

  const exampleQueries = useMemo(
    () => getExampleQueries(selectedProvider?.databaseType, schema),
    [selectedProvider?.databaseType, schema]
  );

  const runQuery = useCallback(async (q?: string) => {
    const queryToRun = q ?? queryStr;
    if (!queryToRun.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const parameters: Record<string, unknown> = {};
      for (const p of params) {
        if (p.key) {
          try { parameters[p.key] = JSON.parse(p.value); } catch { parameters[p.key] = p.value; }
        }
      }
      const res = await consoleTestQuery(provider, { dataset, query: queryToRun, limit, parameters: Object.keys(parameters).length > 0 ? parameters : undefined });
      const data = res.data ?? res;
      setResult(data);

      const entry: QueryHistoryEntry = {
        query: queryToRun,
        provider,
        dataset,
        timestamp: Date.now(),
        nodeCount: data.nodes?.length ?? res.nodeCount ?? 0,
        edgeCount: data.edges?.length ?? res.edgeCount ?? 0,
        executionTime: res.executionTime,
      };
      const newHistory = [entry, ...history.filter((h) => h.query !== queryToRun)].slice(0, MAX_HISTORY);
      setHistory(newHistory);
      saveHistory(newHistory);
    } catch (e: any) {
      setError(e.message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [queryStr, provider, dataset, limit, history, params]);

  const nodeColumns: ColumnsType<GNode> = useMemo(() => [
    {
      title: "ID",
      dataIndex: "id",
      key: "id",
      width: 180,
      ellipsis: true,
      render: (id: string) => (
        <Typography.Text code copyable={{ text: id }}>
          {id.length > 20 ? id.slice(0, 20) + "..." : id}
        </Typography.Text>
      ),
    },
    {
      title: "Labels",
      key: "labels",
      width: 180,
      render: (_: unknown, node: GNode) => {
        const labels = node.labels ?? (node.type ? [node.type] : []);
        return labels.map((l) => (
          <Tag key={l} color="blue">{l}</Tag>
        ));
      },
    },
    {
      title: "Properties",
      key: "properties",
      render: (_: unknown, node: GNode) => {
        const props = node.properties ?? {};
        const keys = Object.keys(props);
        if (keys.length === 0) return <Typography.Text type="secondary">-</Typography.Text>;
        const display = keys.slice(0, 4);
        return (
          <Space size={4} wrap>
            {display.map((k) => (
              <Tooltip key={k} title={`${k}: ${JSON.stringify(props[k])}`}>
                <Tag>{k}: {truncateValue(props[k])}</Tag>
              </Tooltip>
            ))}
            {keys.length > 4 && (
              <Typography.Text type="secondary">+{keys.length - 4} more</Typography.Text>
            )}
          </Space>
        );
      },
    },
    {
      title: "",
      key: "actions",
      width: 80,
      render: (_: unknown, node: GNode) => (
        <Tooltip title="Expand neighbors">
          <Button
            size="small"
            type="text"
            icon={<ExpandOutlined />}
            onClick={() => {
              const nodeId = node.id;
              const dbType = selectedProvider?.databaseType;
              let q: string;
              if (dbType === "spanner") {
                q = `GRAPH FinGraph MATCH (n)-[r]-(m) WHERE n.id = '${nodeId}' RETURN n, r, m LIMIT ${limit}`;
              } else {
                q = `MATCH (n)-[r]-(m) WHERE id(n) = '${nodeId}' OR n.id = '${nodeId}' RETURN n, r, m LIMIT ${limit}`;
              }
              setQueryStr(q);
              runQuery(q);
            }}
          />
        </Tooltip>
      ),
    },
  ], [selectedProvider?.databaseType, limit, runQuery]);

  const handleExampleClick = (query: string) => {
    setQueryStr(query);
    runQuery(query);
  };

  const exportJSON = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `query-result-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyJSON = () => {
    if (!result) return;
    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
  };

  const nodes = result?.nodes ?? [];
  const edges = result?.edges ?? [];

  return (
    <div style={{ display: "flex", gap: 16 }}>
      {/* Left: Schema + Examples + History sidebar */}
      <div style={{ width: 280, flexShrink: 0 }}>
        <Card
          size="small"
          title={<Space><DatabaseOutlined /><span>Schema</span></Space>}
          style={{ marginBottom: 12 }}
          loading={schemaLoading}
        >
          {schema ? (
            <Collapse
              size="small"
              ghost
              defaultActiveKey={["categories", "relationships"]}
              items={[
                {
                  key: "categories",
                  label: <Space><NodeIndexOutlined /><span>Categories ({schema.categories.length})</span></Space>,
                  children: schema.categories.length === 0 ? (
                    <Typography.Text type="secondary">None</Typography.Text>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {schema.categories.map((c) => (
                        <div key={c.name}>
                          <Tag color="blue" style={{ cursor: "pointer" }} onClick={() => {
                            const q = selectedProvider?.databaseType === "spanner"
                              ? `GRAPH FinGraph MATCH (n:${c.name}) RETURN n LIMIT ${limit}`
                              : `MATCH (n:${c.name}) RETURN n LIMIT ${limit}`;
                            setQueryStr(q);
                          }}>
                            {c.name}
                          </Tag>
                          {c.properties && c.properties.length > 0 && (
                            <div style={{ marginLeft: 8, marginTop: 2 }}>
                              {c.properties.map((p) => (
                                <Typography.Text key={p.name} type="secondary" style={{ fontSize: 11, display: "block" }}>
                                  {p.name}: {p.type}
                                </Typography.Text>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ),
                },
                {
                  key: "relationships",
                  label: <Space><BranchesOutlined /><span>Relationships ({schema.relationships.length})</span></Space>,
                  children: schema.relationships.length === 0 ? (
                    <Typography.Text type="secondary">None</Typography.Text>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {schema.relationships.map((r, i) => (
                        <div key={`${r.type}-${i}`}>
                          <Tooltip title={`(${r.startCategory})-[:${r.type}]->(${r.endCategory})`}>
                            <Tag color="orange" style={{ cursor: "pointer" }} onClick={() => {
                              const q = selectedProvider?.databaseType === "spanner"
                                ? `GRAPH FinGraph MATCH (a:${r.startCategory})-[e:${r.type}]->(b:${r.endCategory}) RETURN a, e, b LIMIT ${limit}`
                                : `MATCH (a:${r.startCategory})-[e:${r.type}]->(b:${r.endCategory}) RETURN a, e, b LIMIT ${limit}`;
                              setQueryStr(q);
                            }}>
                              {r.type}
                            </Tag>
                          </Tooltip>
                          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                            {r.startCategory} -&gt; {r.endCategory}
                          </Typography.Text>
                        </div>
                      ))}
                    </div>
                  ),
                },
              ]}
            />
          ) : (
            <Empty description="No schema" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Card>

        <Card
          size="small"
          title={<Space><ThunderboltOutlined /><span>Examples</span></Space>}
          style={{ marginBottom: 12 }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {exampleQueries.map((eq, i) => (
              <Button
                key={i}
                type="text"
                size="small"
                style={{ textAlign: "left", height: "auto", whiteSpace: "normal", padding: "4px 8px" }}
                onClick={() => handleExampleClick(eq.query)}
              >
                <Typography.Text style={{ fontSize: 12 }}>{eq.label}</Typography.Text>
              </Button>
            ))}
          </div>
        </Card>

        {history.length > 0 && (
          <Card
            size="small"
            title={<Space><HistoryOutlined /><span>History</span></Space>}
            extra={<Button size="small" type="text" danger onClick={() => { setHistory([]); saveHistory([]); }}>Clear</Button>}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {history.slice(0, 10).map((h, i) => (
                <Button
                  key={i}
                  type="text"
                  size="small"
                  style={{ textAlign: "left", height: "auto", whiteSpace: "normal", padding: "4px 8px" }}
                  onClick={() => {
                    setQueryStr(h.query);
                    if (h.provider !== provider) setProvider(h.provider);
                    if (h.dataset !== dataset) setDataset(h.dataset);
                  }}
                >
                  <div>
                    <Typography.Text style={{ fontSize: 11 }} ellipsis>
                      {h.query.length > 60 ? h.query.slice(0, 60) + "..." : h.query}
                    </Typography.Text>
                    <div>
                      <Typography.Text type="secondary" style={{ fontSize: 10 }}>
                        {h.nodeCount}n/{h.edgeCount}e
                        {h.executionTime != null ? ` ${h.executionTime}ms` : ""}
                      </Typography.Text>
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Right: Main query area */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <Typography.Title level={4} style={{ marginBottom: 16 }}>
          Graph Explorer
        </Typography.Title>

        <Card size="small" style={{ marginBottom: 12 }}>
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
              onChange={(v) => setLimit(v ?? 25)}
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

        <Card size="small" style={{ marginBottom: 12 }}>
          <Input.TextArea
            rows={3}
            placeholder={getQueryPlaceholder(selectedProvider?.databaseType)}
            value={queryStr}
            onChange={(e) => setQueryStr(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                runQuery();
              }
            }}
            style={{ fontFamily: "monospace", fontSize: 13 }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              Ctrl+Enter to execute
            </Typography.Text>
            <Space>
              <Badge count={activeParamCount} size="small" offset={[-4, 0]}>
                <Button
                  size="small"
                  icon={<PlusOutlined />}
                  type={showParams ? "primary" : "default"}
                  ghost={showParams}
                  onClick={() => {
                    if (!showParams && params.length === 0) {
                      setParams([{ key: "", value: "" }]);
                    }
                    setShowParams(!showParams);
                  }}
                >
                  Params
                </Button>
              </Badge>
              <Dropdown
                menu={{
                  items: exampleQueries.map((eq, i) => ({
                    key: String(i),
                    label: eq.label,
                    onClick: () => handleExampleClick(eq.query),
                  })),
                }}
              >
                <Button size="small" icon={<ThunderboltOutlined />}>Examples</Button>
              </Dropdown>
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={() => runQuery()}
                loading={loading}
              >
                Execute
              </Button>
            </Space>
          </div>
          {showParams && (
            <div style={{ marginTop: 8, padding: "8px 12px", borderTop: "1px solid #2a2d3a", background: "#1a1c24", borderRadius: "0 0 6px 6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                  Query Parameters {activeParamCount > 0 && `(${activeParamCount})`}
                </Typography.Text>
                <Space size={4}>
                  {params.length > 0 && (
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => { setParams([]); setShowParams(false); }}>
                      Clear All
                    </Button>
                  )}
                  <Button size="small" type="text" icon={<PlusOutlined />} onClick={() => setParams([...params, { key: "", value: "" }])}>
                    Add
                  </Button>
                </Space>
              </div>
              {params.length === 0 ? (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  No parameters. Click "Add" to add key-value pairs.
                </Typography.Text>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {params.map((p, i) => (
                    <Space key={i} style={{ display: "flex" }} align="center">
                      <Input
                        size="small"
                        placeholder="Key"
                        value={p.key}
                        onChange={(e) => { const np = [...params]; np[i] = { ...np[i], key: e.target.value }; setParams(np); }}
                        style={{ width: 130, fontFamily: "monospace" }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const valueInput = e.currentTarget.parentElement?.querySelector<HTMLInputElement>('input:nth-child(1)');
                            if (valueInput) valueInput.focus();
                          }
                        }}
                      />
                      <Input
                        size="small"
                        placeholder="Value (JSON or string)"
                        value={p.value}
                        onChange={(e) => { const np = [...params]; np[i] = { ...np[i], value: e.target.value }; setParams(np); }}
                        style={{ width: 220, fontFamily: "monospace" }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            if (i === params.length - 1) {
                              setParams([...params, { key: "", value: "" }]);
                            }
                          }
                        }}
                      />
                      <Tooltip title="Remove parameter">
                        <Button
                          size="small"
                          type="text"
                          danger
                          icon={<MinusCircleOutlined />}
                          onClick={() => {
                            const newParams = params.filter((_, j) => j !== i);
                            setParams(newParams);
                            if (newParams.length === 0) setShowParams(false);
                          }}
                        />
                      </Tooltip>
                    </Space>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>

        {error && (
          <Alert type="error" message={error} style={{ marginBottom: 12 }} closable onClose={() => setError(null)} />
        )}

        {result && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Space>
                <Typography.Text strong>Results</Typography.Text>
                <Space size={8}>
                  <Tag icon={<NodeIndexOutlined />} color="blue">{nodes.length} nodes</Tag>
                  <Tag icon={<BranchesOutlined />} color="orange">{edges.length} edges</Tag>
                </Space>
                {result.summary?.executionTime != null && (
                  <Typography.Text type="secondary">{result.summary.executionTime}ms</Typography.Text>
                )}
                {result.provenance && (
                  <Typography.Text type="secondary">
                    via {result.provenance.provider}/{result.provenance.dataset}
                  </Typography.Text>
                )}
              </Space>
              <Space>
                <Tooltip title="Copy JSON"><Button size="small" icon={<CopyOutlined />} onClick={copyJSON} /></Tooltip>
                <Tooltip title="Export JSON"><Button size="small" icon={<DownloadOutlined />} onClick={exportJSON} /></Tooltip>
                <Segmented
                  size="small"
                  value={viewMode}
                  onChange={(v) => setViewMode(v as ViewMode)}
                  options={[
                    { value: "table", icon: <NodeIndexOutlined /> },
                    { value: "json", icon: <CodeOutlined /> },
                  ]}
                />
              </Space>
            </div>

            {viewMode === "table" ? (
              <>
                {nodes.length > 0 && (
                  <Card size="small" title={<Space><NodeIndexOutlined /><span>Nodes ({nodes.length})</span></Space>} style={{ marginBottom: 12 }}>
                    <Table columns={nodeColumns} dataSource={nodes} rowKey="id" pagination={nodes.length > 20 ? { pageSize: 20 } : false} size="small" scroll={{ x: 600 }} />
                  </Card>
                )}
                {edges.length > 0 && (
                  <Card size="small" title={<Space><BranchesOutlined /><span>Edges ({edges.length})</span></Space>}>
                    <Table columns={EDGE_COLUMNS} dataSource={edges} rowKey="id" pagination={edges.length > 20 ? { pageSize: 20 } : false} size="small" scroll={{ x: 800 }} />
                  </Card>
                )}
                {nodes.length === 0 && edges.length === 0 && (
                  <Alert type="info" message="Query returned no graph data" description="The query executed successfully but returned no nodes or edges." />
                )}
              </>
            ) : (
              <Card size="small">
                <pre style={{ background: "#12141c", padding: 16, borderRadius: 8, overflow: "auto", maxHeight: 500, fontSize: 13, lineHeight: 1.5, color: "#e0e0e0", margin: 0 }}>
                  {JSON.stringify(result, null, 2)}
                </pre>
              </Card>
            )}
          </div>
        )}

        {loading && !result && <Spin style={{ display: "block", marginTop: 32 }} />}
      </div>
    </div>
  );
}

function getQueryPlaceholder(dbType?: string): string {
  switch (dbType) {
    case "neo4j":
    case "memgraph":
      return "MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 25";
    case "spanner":
      return "GRAPH FinGraph MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 25";
    default:
      return "MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 25";
  }
}
