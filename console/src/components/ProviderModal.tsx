import { useEffect } from "react";
import { Modal, Form, Input, Select, Space, Button } from "antd";
import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import type { ProviderConfig } from "../api.ts";

interface Props {
  open: boolean;
  editData?: ProviderConfig | null;
  onOk: (data: ProviderConfig) => void;
  onCancel: () => void;
  loading?: boolean;
}

export default function ProviderModal({ open, editData, onOk, onCancel, loading }: Props) {
  const [form] = Form.useForm();
  const transport = Form.useWatch("transport", form);

  useEffect(() => {
    if (open) {
      if (editData) {
        const envList = editData.env
          ? Object.entries(editData.env).map(([key, value]) => ({ key, value }))
          : [];
        form.setFieldsValue({ ...editData, envList });
      } else {
        form.resetFields();
        form.setFieldsValue({ transport: "stdio", datasets: [], args: [], envList: [] });
      }
    }
  }, [open, editData]);

  const handleOk = () => {
    form.validateFields().then((values) => {
      const env: Record<string, string> = {};
      (values.envList || []).forEach((item: { key: string; value: string }) => {
        if (item.key) env[item.key] = item.value || "";
      });
      onOk({
        name: values.name,
        transport: values.transport,
        command: values.command || undefined,
        args: values.args || [],
        env: Object.keys(env).length > 0 ? env : undefined,
        endpoint: values.endpoint || undefined,
        datasets: values.datasets || [],
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
      width={560}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item
          label="Name"
          name="name"
          rules={[{ required: true, message: "Provider name is required" }]}
        >
          <Input disabled={!!editData} placeholder="e.g. my-neo4j" />
        </Form.Item>

        <Form.Item label="Transport" name="transport" rules={[{ required: true }]}>
          <Select
            options={[
              { label: "STDIO", value: "stdio" },
              { label: "HTTP", value: "http" },
            ]}
          />
        </Form.Item>

        {transport === "stdio" && (
          <>
            <Form.Item
              label="Command"
              name="command"
              rules={[{ required: true, message: "Command is required for stdio" }]}
            >
              <Input placeholder="e.g. npx" />
            </Form.Item>
            <Form.Item label="Args" name="args">
              <Select
                mode="tags"
                placeholder="e.g. -y @neo4j/mcp-server"
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
            <Input placeholder="e.g. http://localhost:3000/mcp" />
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
                      <Input placeholder="KEY" style={{ width: 180 }} />
                    </Form.Item>
                    <Form.Item name={[field.name, "value"]} noStyle>
                      <Input placeholder="value" style={{ width: 220 }} />
                    </Form.Item>
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
