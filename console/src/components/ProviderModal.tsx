import { useEffect, useState } from "react";
import { Modal, Form, Input, Select, Space, Button, Alert, Typography, Divider } from "antd";
import { MinusCircleOutlined, PlusOutlined, ThunderboltOutlined } from "@ant-design/icons";
import type { ProviderConfig, ProviderTemplate, DatabaseType } from "../api.ts";
import { getTemplates } from "../api.ts";

const { Text } = Typography;

const DATABASE_TYPE_OPTIONS: { label: string; value: DatabaseType }[] = [
  { label: "Neo4j", value: "neo4j" },
  { label: "Spanner Graph", value: "spanner" },
  { label: "PostgreSQL", value: "postgresql" },
  { label: "MySQL", value: "mysql" },
  { label: "MongoDB", value: "mongodb" },
  { label: "Neptune", value: "neptune" },
  { label: "TigerGraph", value: "tigergraph" },
  { label: "Memgraph", value: "memgraph" },
  { label: "Generic", value: "generic" },
];

interface Props {
  open: boolean;
  editData?: ProviderConfig | null;
  onOk: (data: ProviderConfig) => void;
  onCancel: () => void;
  loading?: boolean;
}

function EnvValueInput({ fieldName, form }: { fieldName: number; form: ReturnType<typeof Form.useForm>[0] }) {
  const key = Form.useWatch(["envList", fieldName, "key"], form);
  const isSensitive = /password|secret|token|key|credentials|api_key|auth/i.test(key || "");
  return (
    <Form.Item name={[fieldName, "value"]} noStyle>
      {isSensitive ? (
        <Input.Password placeholder="value (sensitive)" style={{ width: 250 }} />
      ) : (
        <Input placeholder="value" style={{ width: 250 }} />
      )}
    </Form.Item>
  );
}

export default function ProviderModal({ open, editData, onOk, onCancel, loading }: Props) {
  const [form] = Form.useForm();
  const transport = Form.useWatch("transport", form);
  const [templates, setTemplates] = useState<ProviderTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  useEffect(() => {
    getTemplates().then(setTemplates).catch(() => {});
  }, []);

  useEffect(() => {
    if (open) {
      setSelectedTemplate(null);
      if (editData) {
        const envList = editData.env
          ? Object.entries(editData.env).map(([key, value]) => ({ key, value }))
          : [];
        form.setFieldsValue({ ...editData, envList });
      } else {
        form.resetFields();
        form.setFieldsValue({
          transport: "stdio",
          databaseType: "generic",
          datasets: [],
          args: [],
          envList: [],
        });
      }
    }
  }, [open, editData]);

  const applyTemplate = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;
    setSelectedTemplate(templateId);

    const envList = template.envHints
      ? Object.entries(template.envHints).map(([key, value]) => ({ key, value }))
      : [];

    form.setFieldsValue({
      transport: template.transport,
      databaseType: template.databaseType,
      command: template.defaults.command ?? "",
      args: template.defaults.args ?? [],
      endpoint: template.defaults.endpoint ?? "",
      envList,
    });
  };

  const handleOk = () => {
    form.validateFields().then((values) => {
      const env: Record<string, string> = {};
      (values.envList || []).forEach((item: { key: string; value: string }) => {
        if (item.key) env[item.key] = item.value || "";
      });

      // Build tool mapping from the selected template
      const template = templates.find((t) => t.id === selectedTemplate);
      const toolMapping = template?.toolMapping && Object.keys(template.toolMapping).length > 0
        ? template.toolMapping
        : undefined;

      onOk({
        name: values.name,
        transport: values.transport,
        databaseType: values.databaseType || "generic",
        command: values.command || undefined,
        args: values.args || [],
        env: Object.keys(env).length > 0 ? env : undefined,
        endpoint: values.endpoint || undefined,
        datasets: values.datasets || [],
        toolMapping,
      });
    });
  };

  return (
    <Modal
      title={editData ? "Edit Provider" : "Add Provider"}
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={loading}
      destroyOnClose
      width={600}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        {/* Quick Setup from Template */}
        {!editData && templates.length > 0 && (
          <>
            <Form.Item label={<><ThunderboltOutlined /> Quick Setup</>}>
              <Select
                placeholder="Select a template to auto-fill settings..."
                allowClear
                onChange={applyTemplate}
                value={selectedTemplate}
                options={templates.map((t) => ({
                  label: t.label,
                  value: t.id,
                }))}
              />
              {selectedTemplate && (
                <Alert
                  style={{ marginTop: 8 }}
                  type="info"
                  showIcon
                  message={
                    <Text type="secondary">
                      {templates.find((t) => t.id === selectedTemplate)?.description}
                    </Text>
                  }
                />
              )}
            </Form.Item>
            <Divider style={{ margin: "8px 0 16px" }} />
          </>
        )}

        <Form.Item
          label="Name"
          name="name"
          rules={[{ required: true, message: "Provider name is required" }]}
        >
          <Input disabled={!!editData} placeholder="e.g. my-neo4j" />
        </Form.Item>

        <Space size="middle" style={{ display: "flex" }}>
          <Form.Item
            label="Database Type"
            name="databaseType"
            style={{ flex: 1 }}
          >
            <Select options={DATABASE_TYPE_OPTIONS} />
          </Form.Item>

          <Form.Item label="Transport" name="transport" rules={[{ required: true }]} style={{ flex: 1 }}>
            <Select
              options={[
                { label: "STDIO (local process)", value: "stdio" },
                { label: "HTTP/SSE (remote)", value: "http" },
              ]}
            />
          </Form.Item>
        </Space>

        {transport === "stdio" && (
          <>
            <Form.Item
              label="Command"
              name="command"
              rules={[{ required: true, message: "Command is required for stdio" }]}
            >
              <Input placeholder="e.g. neo4j-mcp-server, npx, uvx" />
            </Form.Item>
            <Form.Item label="Args" name="args">
              <Select
                mode="tags"
                placeholder="e.g. mcp-neo4j-cypher"
                tokenSeparators={[" "]}
              />
            </Form.Item>
          </>
        )}

        {transport === "http" && (
          <Form.Item
            label="Endpoint"
            name="endpoint"
            rules={[{ required: true, message: "Endpoint URL is required for HTTP" }]}
          >
            <Input placeholder="e.g. http://localhost:5000/mcp" />
          </Form.Item>
        )}

        <Form.Item
          label="Datasets"
          name="datasets"
          rules={[{ required: true, message: "At least one dataset is required" }]}
        >
          <Select mode="tags" placeholder="e.g. movies, knowledge-graph" tokenSeparators={[","]} />
        </Form.Item>

        {/* Environment Variables */}
        <Form.Item label="Environment Variables">
          <Form.List name="envList">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field) => (
                  <Space key={field.key} align="baseline" style={{ display: "flex", marginBottom: 8 }}>
                    <Form.Item name={[field.name, "key"]} noStyle>
                      <Input placeholder="KEY" style={{ width: 200 }} />
                    </Form.Item>
                    <EnvValueInput fieldName={field.name} form={form} />
                    <MinusCircleOutlined onClick={() => remove(field.name)} />
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />} size="small">
                  Add Variable
                </Button>
              </>
            )}
          </Form.List>
        </Form.Item>
      </Form>
    </Modal>
  );
}
