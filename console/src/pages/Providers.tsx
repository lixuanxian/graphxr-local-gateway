import { useEffect, useState } from "react";
import {
  Table,
  Typography,
  Tag,
  Spin,
  Button,
  Space,
  Popconfirm,
  Tooltip,
  Drawer,
  Descriptions,
  List,
  Timeline,
  Divider,
} from "antd";
import { App as AntdApp } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  ApiOutlined,
  InfoCircleOutlined,
  LinkOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import StatusBadge from "../components/StatusBadge.tsx";
import ProviderModal from "../components/ProviderModal.tsx";
import {
  getProviders,
  addProvider,
  updateProvider,
  deleteProvider,
  restartProvider,
  getProviderTools,
  getProviderEvents,
  testProviderConnection,
  type ProviderInfo,
  type ProviderConfig,
  type ProviderTools,
  type ProviderTestResult,
  type ConnectionEvent,
} from "../api.ts";
import { EVENT_CONFIG } from "../utils/event-config.tsx";

const DB_TYPE_COLORS: Record<string, string> = {
  spanner: "blue",
  neo4j: "green",
  memgraph: "volcano",
  // postgresql: "cyan",
  // mysql: "orange",
  // mongodb: "lime",
  neptune: "purple",
  tigergraph: "magenta",
  generic: "default",
};

export default function Providers() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editData, setEditData] = useState<ProviderConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const { message } = AntdApp.useApp();

  // Detail drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailProvider, setDetailProvider] = useState<ProviderInfo | null>(null);
  const [detailTools, setDetailTools] = useState<ProviderTools | null>(null);
  const [detailEvents, setDetailEvents] = useState<ConnectionEvent[]>([]);
  const [testResult, setTestResult] = useState<ProviderTestResult | null>(null);
  const [testing, setTesting] = useState(false);

  const load = () => {
    setLoading(true);
    getProviders()
      .then(setProviders)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const openDetail = async (record: ProviderInfo) => {
    setDetailProvider(record);
    setDrawerOpen(true);
    setTestResult(null);
    // Load tools and events in parallel
    Promise.all([
      getProviderTools(record.name).catch(() => null),
      getProviderEvents(record.name, 20).catch(() => []),
    ]).then(([tools, events]) => {
      setDetailTools(tools);
      setDetailEvents(events);
    });
  };

  const runProviderTest = async (name: string) => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testProviderConnection(name);
      setTestResult(result);
    } catch (err: any) {
      message.error(`Test failed: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  const handleAdd = () => {
    setEditData(null);
    setModalOpen(true);
  };

  const handleEdit = (record: ProviderInfo) => {
    setEditData({
      name: record.name,
      transport: record.transport,
      databaseType: record.databaseType,
      datasets: record.datasets,
      command: record.command,
      args: record.args,
      env: record.env,
      endpoint: record.endpoint,
      toolMapping: record.toolMapping,
    });
    setModalOpen(true);
  };

  const handleModalOk = async (data: ProviderConfig) => {
    setSaving(true);
    try {
      if (editData) {
        await updateProvider(data.name, data);
        message.success(`Provider "${data.name}" updated`);
      } else {
        await addProvider(data);
        message.success(`Provider "${data.name}" added`);
      }
      setModalOpen(false);
      load();
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (name: string) => {
    try {
      await deleteProvider(name);
      message.success(`Provider "${name}" deleted`);
      load();
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const handleRestart = async (name: string) => {
    try {
      await restartProvider(name);
      message.success(`Provider "${name}" restarted`);
      load();
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const columns: ColumnsType<ProviderInfo> = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      render: (name: string, record: ProviderInfo) => (
        <Button type="link" style={{ padding: 0 }} onClick={() => openDetail(record)}>
          <Typography.Text strong>{name}</Typography.Text>
        </Button>
      ),
    },
    {
      title: "Type",
      dataIndex: "databaseType",
      key: "databaseType",
      render: (t: string) => (
        <Tag color={DB_TYPE_COLORS[t] ?? "default"}>
          {t.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: "Transport",
      dataIndex: "transport",
      key: "transport",
      render: (t: string) => <Tag>{t.toUpperCase()}</Tag>,
    },
    {
      title: "Datasets",
      dataIndex: "datasets",
      key: "datasets",
      render: (ds: string[]) =>
        ds.map((d) => (
          <Tag key={d} color="blue">
            {d}
          </Tag>
        )),
    },
    {
      title: "MCP Tools",
      dataIndex: "tools",
      key: "tools",
      render: (tools: string[] | undefined) => {
        if (!tools || tools.length === 0) return <Typography.Text type="secondary">-</Typography.Text>;
        return (
          <Tooltip title={tools.join(", ")}>
            <Tag icon={<ApiOutlined />} color="geekblue">
              {tools.length} tools
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (s: string) => <StatusBadge status={s} />,
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Details">
            <Button
              size="small"
              icon={<InfoCircleOutlined />}
              onClick={() => openDetail(record)}
            />
          </Tooltip>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          <Tooltip title="Restart connection">
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => handleRestart(record.name)}
            />
          </Tooltip>
          <Popconfirm
            title={`Delete "${record.name}"?`}
            onConfirm={() => handleDelete(record.name)}
            okText="Delete"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (loading) return <Spin size="large" style={{ display: "block", marginTop: 80 }} />;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Providers
        </Typography.Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load}>
            Refresh
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            Add Provider
          </Button>
        </Space>
      </div>
      <Table
        columns={columns}
        dataSource={providers}
        rowKey="name"
        pagination={false}
        size="middle"
        locale={{
          emptyText: (
            <div style={{ padding: "40px 0", textAlign: "center" }}>
              <ApiOutlined style={{ fontSize: 40, color: "#555", marginBottom: 12 }} />
              <Typography.Title level={5} style={{ marginBottom: 8 }}>
                No Providers Yet
              </Typography.Title>
              <Typography.Paragraph type="secondary" style={{ maxWidth: 400, margin: "0 auto 16px" }}>
                Providers connect the gateway to graph databases via MCP protocol.
                Add your first provider to start querying.
              </Typography.Paragraph>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                Add Provider
              </Button>
            </div>
          ),
        }}
      />
      <ProviderModal
        open={modalOpen}
        editData={editData}
        onOk={handleModalOk}
        onCancel={() => setModalOpen(false)}
        loading={saving}
      />

      {/* Provider Detail Drawer */}
      <Drawer
        title={
          detailProvider ? (
            <Space>
              <Typography.Text strong>{detailProvider.name}</Typography.Text>
              <StatusBadge status={detailProvider.status} />
            </Space>
          ) : "Provider Details"
        }
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={480}
      >
        {detailProvider && (
          <>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Database Type">
                <Tag color={DB_TYPE_COLORS[detailProvider.databaseType] ?? "default"}>
                  {detailProvider.databaseType.toUpperCase()}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Transport">
                <Tag>{detailProvider.transport.toUpperCase()}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Datasets">
                <Space wrap>
                  {detailProvider.datasets.map((d) => (
                    <Tag key={d} color="blue">{d}</Tag>
                  ))}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <StatusBadge status={detailProvider.status} />
              </Descriptions.Item>
            </Descriptions>

            {/* MCP Tools */}
            <Divider orientation="left" style={{ fontSize: 13 }}>
              <ApiOutlined /> MCP Tools
            </Divider>
            {detailTools ? (
              <>
                {detailTools.toolDetails && detailTools.toolDetails.length > 0 ? (
                  <List
                    size="small"
                    dataSource={detailTools.toolDetails}
                    renderItem={(td) => {
                      const mappedAs = Object.entries(detailTools.toolMapping)
                        .filter(([, v]) => v === td.name)
                        .map(([k]) => k);
                      return (
                        <List.Item style={{ display: "block" }}>
                          <div>
                            <Typography.Text code>{td.name}</Typography.Text>
                            {mappedAs.length > 0 && (
                              <Space style={{ marginLeft: 8 }}>
                                {mappedAs.map((m) => (
                                  <Tag key={m} color="geekblue" style={{ fontSize: 11 }}>
                                    {m}
                                  </Tag>
                                ))}
                              </Space>
                            )}
                          </div>
                          {td.description && (
                            <Typography.Text type="secondary" style={{ fontSize: 12, display: "block", marginTop: 2 }}>
                              {td.description}
                            </Typography.Text>
                          )}
                          {td.inputSchema && Object.keys(td.inputSchema).length > 0 && (
                            <div style={{ marginTop: 4 }}>
                              {Object.entries(
                                (td.inputSchema as any).properties ?? {}
                              ).map(([key, val]: [string, any]) => (
                                <Tag key={key} style={{ fontSize: 10, marginBottom: 2 }}>
                                  {key}: {val?.type ?? "any"}
                                  {(td.inputSchema as any).required?.includes(key) ? " *" : ""}
                                </Tag>
                              ))}
                            </div>
                          )}
                        </List.Item>
                      );
                    }}
                  />
                ) : detailTools.tools.length > 0 ? (
                  <List
                    size="small"
                    dataSource={detailTools.tools}
                    renderItem={(tool) => (
                      <List.Item>
                        <Typography.Text code>{tool}</Typography.Text>
                      </List.Item>
                    )}
                  />
                ) : (
                  <Typography.Text type="secondary">No tools discovered</Typography.Text>
                )}
              </>
            ) : (
              <Typography.Text type="secondary">
                Tools information not available
              </Typography.Text>
            )}

            {/* Connection Test */}
            <Divider orientation="left" style={{ fontSize: 13 }}>
              <CheckCircleOutlined /> Connection Test
            </Divider>
            <Button
              type="primary"
              size="small"
              loading={testing}
              onClick={() => detailProvider && runProviderTest(detailProvider.name)}
              style={{ marginBottom: 8 }}
            >
              Test Connection
            </Button>
            {testResult && (
              <List
                size="small"
                dataSource={testResult.results}
                renderItem={(item) => (
                  <List.Item>
                    <Tag color={item.status === "pass" ? "green" : "red"}>{item.status.toUpperCase()}</Tag>
                    <Typography.Text strong style={{ width: 80, display: "inline-block" }}>{item.check}</Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {item.detail} {item.ms > 0 ? `(${item.ms}ms)` : ""}
                    </Typography.Text>
                  </List.Item>
                )}
              />
            )}

            {/* Connection Events */}
            <Divider orientation="left" style={{ fontSize: 13 }}>
              <LinkOutlined /> Recent Events
            </Divider>
            {detailEvents.length > 0 ? (
              <Timeline
                items={detailEvents
                  .slice()
                  .reverse()
                  .slice(0, 10)
                  .map((evt) => {
                    const cfg = EVENT_CONFIG[evt.event] ?? { color: "gray", icon: null };
                    const time = new Date(evt.timestamp).toLocaleTimeString();
                    return {
                      color: cfg.color,
                      dot: cfg.icon,
                      children: (
                        <div>
                          <Tag color={cfg.color} style={{ fontSize: 11 }}>{evt.event}</Tag>
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            {time}
                          </Typography.Text>
                          {evt.detail && (
                            <div>
                              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                                {evt.detail.length > 60 ? evt.detail.slice(0, 60) + "..." : evt.detail}
                              </Typography.Text>
                            </div>
                          )}
                        </div>
                      ),
                    };
                  })}
              />
            ) : (
              <Typography.Text type="secondary">No connection events</Typography.Text>
            )}
          </>
        )}
      </Drawer>
    </div>
  );
}
