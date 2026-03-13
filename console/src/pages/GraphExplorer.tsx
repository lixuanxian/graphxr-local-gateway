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
} from "antd";
import { SendOutlined } from "@ant-design/icons";
import {
  getProviders,
  graphNeighbors,
  graphQuery,
  type ProviderInfo,
} from "../api.ts";

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

  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const runNeighbors = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await graphNeighbors({ provider, dataset, nodeId, limit });
      setResult(res);
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
      const res = await graphQuery({ provider, dataset, query: queryStr, limit });
      setResult(res);
    } catch (e: any) {
      setError(e.message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

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
            style={{ width: 160 }}
            options={providers.map((p) => ({
              value: p.name,
              label: p.name,
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
                  placeholder="Enter query (e.g. GQL, Cypher, SQL...)"
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
        <Card
          title={
            <Space>
              <span>Result</span>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {result.summary?.counts
                  ? `${result.summary.counts.nodes} nodes, ${result.summary.counts.edges} edges`
                  : ""}
              </Typography.Text>
            </Space>
          }
          size="small"
          style={{ marginTop: 16 }}
        >
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

      {loading && !result && (
        <Spin style={{ display: "block", marginTop: 32 }} />
      )}
    </div>
  );
}
