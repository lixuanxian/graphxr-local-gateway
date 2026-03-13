import { useEffect, useState } from "react";
import { Table, Typography, Tag, Spin, Button, Space, Popconfirm } from "antd";
import { App as AntdApp } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import StatusBadge from "../components/StatusBadge.tsx";
import ProviderModal from "../components/ProviderModal.tsx";
import {
  getProviders,
  addProvider,
  updateProvider,
  deleteProvider,
  restartProvider,
  type ProviderInfo,
  type ProviderConfig,
} from "../api.ts";

export default function Providers() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editData, setEditData] = useState<ProviderConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const { message } = AntdApp.useApp();

  const load = () => {
    setLoading(true);
    getProviders()
      .then(setProviders)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = () => {
    setEditData(null);
    setModalOpen(true);
  };

  const handleEdit = (record: ProviderInfo) => {
    setEditData({
      name: record.name,
      transport: record.transport,
      datasets: record.datasets,
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
      render: (name: string) => <Typography.Text strong>{name}</Typography.Text>,
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
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          <Button
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => handleRestart(record.name)}
          />
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
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          Add Provider
        </Button>
      </div>
      <Table
        columns={columns}
        dataSource={providers}
        rowKey="name"
        pagination={false}
        size="middle"
      />
      <ProviderModal
        open={modalOpen}
        editData={editData}
        onOk={handleModalOk}
        onCancel={() => setModalOpen(false)}
        loading={saving}
      />
    </div>
  );
}
