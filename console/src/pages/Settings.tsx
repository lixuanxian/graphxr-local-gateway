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
  Descriptions,
  Divider,
} from "antd";
import { App as AntdApp } from "antd";
import { SaveOutlined, ReloadOutlined } from "@ant-design/icons";
import { getSettings, updateSettings, type Settings as SettingsType } from "../api.ts";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0 && h === 0) parts.push(`${s}s`);
  return parts.join(" ") || "0s";
}

export default function Settings() {
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authEnabled, setAuthEnabled] = useState(false);
  const [allowAll, setAllowAll] = useState(false);
  const [origins, setOrigins] = useState<string[]>([]);
  const { message } = AntdApp.useApp();
  const [form] = Form.useForm();
  const tokenTTL = Form.useWatch("tokenTTL", form);
  const pairingTimeout = Form.useWatch("pairingTimeout", form);

  const load = () => {
    setLoading(true);
    getSettings()
      .then((s) => {
        setSettings(s);
        setAuthEnabled(s.authEnabled);
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
        authEnabled,
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Settings
        </Typography.Title>
        <Button icon={<ReloadOutlined />} onClick={load}>
          Reload
        </Button>
      </div>

      {/* Read-only info */}
      <Card size="small" style={{ marginBottom: 16, maxWidth: 640 }}>
        <Descriptions column={2} size="small">
          <Descriptions.Item label="Listen Port">
            <Typography.Text code>127.0.0.1:{settings.port}</Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label="Rate Limit">
            {settings.rateLimit.max} req / {settings.rateLimit.windowMs / 1000}s
          </Descriptions.Item>
        </Descriptions>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Port and rate limit require a server restart to change.
        </Typography.Text>
      </Card>

      <Card style={{ maxWidth: 640 }} title="Runtime Settings">
        <Form form={form} layout="vertical">
          {/* Authentication */}
          <Form.Item
            label="Bearer Token Authentication"
            extra={authEnabled
              ? "Clients must pair and obtain a bearer token to access API endpoints."
              : "Authentication is disabled. All API endpoints are accessible without a token."}
          >
            <Space>
              <Switch checked={authEnabled} onChange={setAuthEnabled} />
              <Typography.Text>
                {authEnabled ? "Enabled — clients must authenticate" : "Disabled — open access (development mode)"}
              </Typography.Text>
            </Space>
          </Form.Item>

          <Divider />

          {/* Allowed Origins */}
          <Form.Item
            label="CORS Allowed Origins"
            extra="Origins that are allowed to make requests to the gateway API."
          >
            <Space direction="vertical" style={{ width: "100%" }}>
              <Space>
                <Switch checked={allowAll} onChange={setAllowAll} />
                <Typography.Text>
                  {allowAll ? "All origins allowed (development mode)" : "Specific origins only"}
                </Typography.Text>
              </Space>
              {!allowAll && (
                <Select
                  mode="tags"
                  placeholder="Enter origins (e.g. https://graphxr.kineviz.com)"
                  value={origins}
                  onChange={setOrigins}
                  style={{ width: "100%" }}
                  tokenSeparators={[","]}
                />
              )}
            </Space>
          </Form.Item>

          {authEnabled && (
            <>
              <Divider />

              {/* Token TTL */}
              <Form.Item
                label="Bearer Token TTL"
                name="tokenTTL"
                extra={`Tokens expire after ${formatDuration(tokenTTL ?? settings.tokenTTL)}. Clients must re-pair after expiration.`}
              >
                <InputNumber
                  min={60}
                  max={604800}
                  addonAfter="seconds"
                  style={{ width: 220 }}
                />
              </Form.Item>

              {/* Pairing Timeout */}
              <Form.Item
                label="Pairing Request Timeout"
                name="pairingTimeout"
                extra={`Users have ${formatDuration(pairingTimeout ?? settings.pairingTimeout)} to approve or deny a pairing request.`}
              >
                <InputNumber
                  min={30}
                  max={3600}
                  addonAfter="seconds"
                  style={{ width: 220 }}
                />
              </Form.Item>
            </>
          )}

          <Divider />

          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            onClick={handleSave}
          >
            Save Settings
          </Button>
        </Form>
      </Card>
    </div>
  );
}
