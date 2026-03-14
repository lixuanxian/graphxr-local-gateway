import { useEffect, useState } from "react";
import {
  Tabs,
  Table,
  Tag,
  Button,
  Typography,
  Spin,
  Popconfirm,
  Space,
  Statistic,
  Modal,
  Input,
  Alert,
  App as AntdApp,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { ReloadOutlined, DeleteOutlined, PlusOutlined, CopyOutlined, StopOutlined } from "@ant-design/icons";
import {
  getSessions,
  getTokens,
  revokeToken,
  createToken,
  revokeAllTokens,
  type Session,
  type TokenInfo,
} from "../api.ts";

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ${min % 60}m ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

function timeUntil(dateStr: string): { text: string; expired: boolean } {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return { text: "Expired", expired: true };
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  if (hr > 0) return { text: `${hr}h ${min % 60}m`, expired: false };
  if (min > 0) return { text: `${min}m ${sec % 60}s`, expired: false };
  return { text: `${sec}s`, expired: false };
}

const sessionColumns: ColumnsType<Session> = [
  {
    title: "Origin",
    dataIndex: "origin",
    key: "origin",
    render: (v: string) => (
      <Typography.Text copyable style={{ fontSize: 13 }}>
        {v || "(empty)"}
      </Typography.Text>
    ),
  },
  {
    title: "Scopes",
    dataIndex: "scopes",
    key: "scopes",
    render: (scopes: string[]) =>
      scopes.length === 0 ? (
        <Typography.Text type="secondary">-</Typography.Text>
      ) : (
        scopes.map((s) => (
          <Tag key={s} color="cyan">
            {s}
          </Tag>
        ))
      ),
  },
  {
    title: "Status",
    dataIndex: "status",
    key: "status",
    render: (s: string) => {
      const color =
        s === "approved" ? "green" : s === "denied" ? "red" : "orange";
      return <Tag color={color}>{s.toUpperCase()}</Tag>;
    },
  },
  {
    title: "Created",
    dataIndex: "createdAt",
    key: "createdAt",
    render: (v: string) => (
      <Typography.Text title={new Date(v).toLocaleString()}>
        {relativeTime(v)}
      </Typography.Text>
    ),
  },
];

export default function Sessions() {
  const { message } = AntdApp.useApp();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createOrigin, setCreateOrigin] = useState("");
  const [creating, setCreating] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);

  const load = () => {
    Promise.all([getSessions(), getTokens()])
      .then(([s, t]) => {
        setSessions(s);
        setTokens(t);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  const handleRevoke = async (prefix: string) => {
    try {
      await revokeToken(prefix);
      message.success("Token revoked");
      load();
    } catch (e: any) {
      message.error(e.message);
    }
  };

  const handleCreateToken = async () => {
    setCreating(true);
    try {
      const result = await createToken({ origin: createOrigin || "manual" });
      setNewToken(result.token);
      message.success("Token created");
      load();
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleRevokeAll = async () => {
    try {
      const result = await revokeAllTokens();
      message.success(`${result.count} token(s) revoked`);
      load();
    } catch (e: any) {
      message.error(e.message);
    }
  };

  const tokenColumns: ColumnsType<TokenInfo> = [
    {
      title: "Token Prefix",
      dataIndex: "tokenPrefix",
      key: "tokenPrefix",
      render: (v: string) => (
        <Typography.Text code copyable={{ text: v }}>
          {v}...
        </Typography.Text>
      ),
    },
    {
      title: "Origin",
      dataIndex: "origin",
      key: "origin",
      render: (v: string) => v || <Typography.Text type="secondary">(empty)</Typography.Text>,
    },
    {
      title: "Expires",
      dataIndex: "expiresAt",
      key: "expiresAt",
      render: (v: string) => {
        const { text, expired } = timeUntil(v);
        return (
          <Typography.Text
            type={expired ? "danger" : "secondary"}
            title={new Date(v).toLocaleString()}
          >
            {text}
          </Typography.Text>
        );
      },
    },
    {
      title: "Action",
      key: "action",
      width: 100,
      render: (_, record) => (
        <Popconfirm
          title="Revoke this token?"
          description="The client will need to re-pair to get a new token."
          onConfirm={() => handleRevoke(record.tokenPrefix)}
          okText="Revoke"
          okButtonProps={{ danger: true }}
        >
          <Button danger size="small" icon={<DeleteOutlined />}>
            Revoke
          </Button>
        </Popconfirm>
      ),
    },
  ];

  if (loading)
    return <Spin size="large" style={{ display: "block", marginTop: 80 }} />;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Sessions & Tokens
        </Typography.Title>
        <Space>
          <Button icon={<PlusOutlined />} type="primary" onClick={() => { setCreateModalOpen(true); setNewToken(null); setCreateOrigin(""); }}>
            Create Token
          </Button>
          {tokens.length > 0 && (
            <Popconfirm title="Revoke all tokens?" description={`This will revoke ${tokens.length} active token(s).`} onConfirm={handleRevokeAll} okText="Revoke All" okButtonProps={{ danger: true }}>
              <Button danger icon={<StopOutlined />}>Revoke All</Button>
            </Popconfirm>
          )}
          <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
        </Space>
      </div>

      <Space size={16} style={{ marginBottom: 16 }}>
        <Statistic title="Total Sessions" value={sessions.length} />
        <Statistic title="Active Tokens" value={tokens.length} />
        <Statistic
          title="Approved"
          value={sessions.filter((s) => s.status === "approved").length}
          valueStyle={{ color: "#22c55e" }}
        />
      </Space>

      <Tabs
        items={[
          {
            key: "tokens",
            label: `Active Tokens (${tokens.length})`,
            children: (
              <Table
                columns={tokenColumns}
                dataSource={tokens}
                rowKey="tokenPrefix"
                pagination={false}
                size="middle"
                locale={{ emptyText: "No active tokens" }}
              />
            ),
          },
          {
            key: "sessions",
            label: `Pairing Sessions (${sessions.length})`,
            children: (
              <Table
                columns={sessionColumns}
                dataSource={sessions}
                rowKey="id"
                pagination={sessions.length > 20 ? { pageSize: 20 } : false}
                size="middle"
                locale={{ emptyText: "No pairing sessions" }}
              />
            ),
          },
        ]}
      />

      <Modal
        title="Create Access Token"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        footer={newToken ? [
          <Button key="close" onClick={() => setCreateModalOpen(false)}>Close</Button>
        ] : [
          <Button key="cancel" onClick={() => setCreateModalOpen(false)}>Cancel</Button>,
          <Button key="create" type="primary" loading={creating} onClick={handleCreateToken}>Create</Button>,
        ]}
      >
        {!newToken ? (
          <div style={{ marginTop: 16 }}>
            <Typography.Text style={{ display: "block", marginBottom: 8 }}>Origin (optional):</Typography.Text>
            <Input placeholder="e.g. https://graphxr.kineviz.com" value={createOrigin} onChange={(e) => setCreateOrigin(e.target.value)} />
            <Typography.Text type="secondary" style={{ display: "block", marginTop: 8, fontSize: 12 }}>
              The origin this token will be bound to. Leave empty for "manual" origin (works with any client).
            </Typography.Text>
          </div>
        ) : (
          <div style={{ marginTop: 16 }}>
            <Alert type="success" message="Token created successfully" description="Copy this token now — it won't be shown again." style={{ marginBottom: 12 }} />
            <Input.TextArea readOnly value={newToken} rows={3} style={{ fontFamily: "monospace", fontSize: 12 }} />
            <Button icon={<CopyOutlined />} style={{ marginTop: 8 }} onClick={() => { navigator.clipboard.writeText(newToken); message.success("Copied!"); }}>
              Copy Token
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
