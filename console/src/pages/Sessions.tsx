import { useEffect, useState } from "react";
import {
  Tabs,
  Table,
  Tag,
  Button,
  Typography,
  Spin,
  App as AntdApp,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  getSessions,
  getTokens,
  revokeToken,
  type Session,
  type TokenInfo,
} from "../api.ts";

const sessionColumns: ColumnsType<Session> = [
  {
    title: "Origin",
    dataIndex: "origin",
    key: "origin",
    render: (v: string) => (
      <Typography.Text copyable style={{ fontSize: 13 }}>
        {v}
      </Typography.Text>
    ),
  },
  {
    title: "Scopes",
    dataIndex: "scopes",
    key: "scopes",
    render: (scopes: string[]) =>
      scopes.map((s) => (
        <Tag key={s} color="cyan">
          {s}
        </Tag>
      )),
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
    render: (v: string) => new Date(v).toLocaleString(),
  },
];

export default function Sessions() {
  const { message } = AntdApp.useApp();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [loading, setLoading] = useState(true);

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

  const tokenColumns: ColumnsType<TokenInfo> = [
    {
      title: "Token",
      dataIndex: "tokenPrefix",
      key: "tokenPrefix",
      render: (v: string) => (
        <Typography.Text code>{v}…</Typography.Text>
      ),
    },
    {
      title: "Origin",
      dataIndex: "origin",
      key: "origin",
    },
    {
      title: "Expires At",
      dataIndex: "expiresAt",
      key: "expiresAt",
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: "Action",
      key: "action",
      render: (_, record) => (
        <Button
          danger
          size="small"
          onClick={() => handleRevoke(record.tokenPrefix)}
        >
          Revoke
        </Button>
      ),
    },
  ];

  if (loading)
    return <Spin size="large" style={{ display: "block", marginTop: 80 }} />;

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 24 }}>
        Sessions & Tokens
      </Typography.Title>
      <Tabs
        items={[
          {
            key: "sessions",
            label: `Sessions (${sessions.length})`,
            children: (
              <Table
                columns={sessionColumns}
                dataSource={sessions}
                rowKey="id"
                pagination={false}
                size="middle"
              />
            ),
          },
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
              />
            ),
          },
        ]}
      />
    </div>
  );
}
