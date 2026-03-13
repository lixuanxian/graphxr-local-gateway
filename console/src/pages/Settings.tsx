import { useEffect, useState } from "react";
import {
  Card,
  Form,
  InputNumber,
  Switch,
  Select,
  Button,
  Typography,
  Spin,
  Alert,
  Space,
} from "antd";
import { App as AntdApp } from "antd";
import { getSettings, updateSettings, type Settings as SettingsType } from "../api.ts";

export default function Settings() {
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allowAll, setAllowAll] = useState(false);
  const [origins, setOrigins] = useState<string[]>([]);
  const { message } = AntdApp.useApp();
  const [form] = Form.useForm();

  const load = () => {
    setLoading(true);
    getSettings()
      .then((s) => {
        setSettings(s);
        const isWildcard = s.allowedOrigins.length === 1 && s.allowedOrigins[0] === "*";
        setAllowAll(isWildcard);
        setOrigins(isWildcard ? [] : s.allowedOrigins);
        form.setFieldsValue({
          tokenTTL: s.tokenTTL,
          pairingTimeout: s.pairingTimeout,
        });
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const values = form.getFieldsValue();
      const updated = await updateSettings({
        allowedOrigins: allowAll ? ["*"] : origins,
        tokenTTL: values.tokenTTL,
        pairingTimeout: values.pairingTimeout,
      });
      setSettings(updated);
      message.success("Settings saved");
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spin size="large" style={{ display: "block", marginTop: 80 }} />;
  if (error) return <Alert type="error" message="Failed to load settings" description={error} />;
  if (!settings) return null;

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 24 }}>
        Settings
      </Typography.Title>

      <Card style={{ maxWidth: 640 }}>
        <Form form={form} layout="vertical">
          {/* Port (read-only) */}
          <Form.Item label="Port">
            <Typography.Text code>{settings.port}</Typography.Text>
            <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
              (requires restart to change)
            </Typography.Text>
          </Form.Item>

          {/* Allowed Origins */}
          <Form.Item label="Allowed Origins">
            <Space direction="vertical" style={{ width: "100%" }}>
              <Space>
                <Switch checked={allowAll} onChange={setAllowAll} />
                <Typography.Text>Allow all origins</Typography.Text>
              </Space>
              {!allowAll && (
                <Select
                  mode="tags"
                  placeholder="Enter origins (e.g. https://example.com)"
                  value={origins}
                  onChange={setOrigins}
                  style={{ width: "100%" }}
                  tokenSeparators={[","]}
                />
              )}
            </Space>
          </Form.Item>

          {/* Token TTL */}
          <Form.Item label="Token TTL" name="tokenTTL">
            <InputNumber
              min={60}
              max={604800}
              addonAfter="seconds"
              style={{ width: 200 }}
            />
          </Form.Item>
          {form.getFieldValue("tokenTTL") && (
            <Typography.Text type="secondary" style={{ display: "block", marginTop: -16, marginBottom: 16 }}>
              = {Math.floor((form.getFieldValue("tokenTTL") || 0) / 3600)}h{" "}
              {Math.floor(((form.getFieldValue("tokenTTL") || 0) % 3600) / 60)}m
            </Typography.Text>
          )}

          {/* Pairing Timeout */}
          <Form.Item label="Pairing Timeout" name="pairingTimeout">
            <InputNumber
              min={30}
              max={3600}
              addonAfter="seconds"
              style={{ width: 200 }}
            />
          </Form.Item>

          <Button type="primary" loading={saving} onClick={handleSave}>
            Save Settings
          </Button>
        </Form>
      </Card>
    </div>
  );
}
