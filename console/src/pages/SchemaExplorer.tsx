import { useEffect, useState } from "react";
import {
  Card,
  Select,
  Typography,
  Space,
  Spin,
  Alert,
  Table,
  Tag,
  Button,
  Empty,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  ReloadOutlined,
  NodeIndexOutlined,
  BranchesOutlined,
} from "@ant-design/icons";
import {
  getProviders,
  getProviderSchema,
  type ProviderInfo,
  type GraphSchema,
} from "../api.ts";

export default function SchemaExplorer() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [provider, setProvider] = useState("");
  const [dataset, setDataset] = useState("");
  const [datasets, setDatasets] = useState<string[]>([]);
  const [schema, setSchema] = useState<GraphSchema | null>(null);
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
    setSchema(null);
  };

  const loadSchema = async () => {
    if (!provider) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getProviderSchema(provider, dataset || undefined);
      setSchema(result.schema);
    } catch (e: any) {
      setError(e.message);
      setSchema(null);
    } finally {
      setLoading(false);
    }
  };

  // Auto-load on provider/dataset change
  useEffect(() => {
    if (provider && dataset) {
      loadSchema();
    }
  }, [provider, dataset]);

  const categoryColumns: ColumnsType<GraphSchema["categories"][0]> = [
    {
      title: "Category",
      dataIndex: "name",
      key: "name",
      render: (name: string) => (
        <Tag color="blue" icon={<NodeIndexOutlined />}>
          {name}
        </Tag>
      ),
    },
    {
      title: "Count",
      dataIndex: "count",
      key: "count",
      width: 100,
      render: (c?: number) =>
        c != null ? c.toLocaleString() : <Typography.Text type="secondary">-</Typography.Text>,
    },
    {
      title: "Properties",
      key: "properties",
      render: (_, record) => {
        const props = record.properties ?? [];
        if (props.length === 0) return <Typography.Text type="secondary">-</Typography.Text>;
        return (
          <Space size={4} wrap>
            {props.map((p) => (
              <Tag key={p.name}>
                {p.name}: <span style={{ color: "#888" }}>{p.type}</span>
              </Tag>
            ))}
          </Space>
        );
      },
    },
  ];

  const relationshipColumns: ColumnsType<GraphSchema["relationships"][0]> = [
    {
      title: "Relationship Type",
      dataIndex: "type",
      key: "type",
      render: (type: string) => (
        <Tag color="orange" icon={<BranchesOutlined />}>
          {type}
        </Tag>
      ),
    },
    {
      title: "Start",
      dataIndex: "startCategory",
      key: "startCategory",
      render: (c: string) => <Tag color="blue">{c}</Tag>,
    },
    {
      title: "End",
      dataIndex: "endCategory",
      key: "endCategory",
      render: (c: string) => <Tag color="blue">{c}</Tag>,
    },
    {
      title: "Count",
      dataIndex: "count",
      key: "count",
      width: 100,
      render: (c?: number) =>
        c != null ? c.toLocaleString() : <Typography.Text type="secondary">-</Typography.Text>,
    },
    {
      title: "Properties",
      key: "properties",
      render: (_, record) => {
        const props = record.properties ?? [];
        if (props.length === 0) return <Typography.Text type="secondary">-</Typography.Text>;
        return (
          <Space size={4} wrap>
            {props.map((p) => (
              <Tag key={p.name}>
                {p.name}: <span style={{ color: "#888" }}>{p.type}</span>
              </Tag>
            ))}
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Schema Explorer
        </Typography.Title>
        <Button icon={<ReloadOutlined />} onClick={loadSchema} loading={loading}>
          Refresh
        </Button>
      </div>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <span>Provider:</span>
          <Select
            value={provider}
            onChange={handleProviderChange}
            style={{ width: 200 }}
            options={providers.map((p) => ({
              value: p.name,
              label: `${p.name} (${p.databaseType})`,
            }))}
          />
          <span>Dataset:</span>
          <Select
            value={dataset}
            onChange={setDataset}
            style={{ width: 160 }}
            options={datasets.map((d) => ({ value: d, label: d }))}
          />
        </Space>
      </Card>

      {error && (
        <Alert type="error" message={error} style={{ marginBottom: 16 }} closable onClose={() => setError(null)} />
      )}

      {loading && <Spin size="large" style={{ display: "block", marginTop: 40 }} />}

      {!loading && schema && (
        <>
          <Card
            size="small"
            title={
              <Space>
                <NodeIndexOutlined />
                <span>Node Categories ({schema.categories.length})</span>
              </Space>
            }
            style={{ marginBottom: 16 }}
          >
            {schema.categories.length === 0 ? (
              <Empty description="No node categories found" />
            ) : (
              <Table
                columns={categoryColumns}
                dataSource={schema.categories}
                rowKey="name"
                pagination={false}
                size="small"
              />
            )}
          </Card>

          <Card
            size="small"
            title={
              <Space>
                <BranchesOutlined />
                <span>Relationships ({schema.relationships.length})</span>
              </Space>
            }
          >
            {schema.relationships.length === 0 ? (
              <Empty description="No relationships found" />
            ) : (
              <Table
                columns={relationshipColumns}
                dataSource={schema.relationships}
                rowKey={(r) => `${r.type}-${r.startCategory}-${r.endCategory}`}
                pagination={false}
                size="small"
              />
            )}
          </Card>
        </>
      )}

      {!loading && !schema && !error && (
        <Empty description="Select a provider and dataset to view schema" style={{ marginTop: 40 }} />
      )}
    </div>
  );
}
