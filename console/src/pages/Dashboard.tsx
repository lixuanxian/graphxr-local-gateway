import { useEffect, useState } from "react";
import { Card, Col, Row, Statistic, Typography, Spin, Alert, Button, Tag, List, Timeline } from "antd";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ApiOutlined,
  KeyOutlined,
  ExperimentOutlined,
  LinkOutlined,
  DisconnectOutlined,
  WarningOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import {
  getStats,
  runSelfTest,
  getConnectionEvents,
  type Stats,
  type SelfTestResult,
  type ConnectionEvent,
} from "../api.ts";

const EVENT_CONFIG: Record<string, { color: string; icon: React.ReactNode }> = {
  connected: { color: "green", icon: <LinkOutlined /> },
  disconnected: { color: "red", icon: <DisconnectOutlined /> },
  error: { color: "red", icon: <WarningOutlined /> },
  reconnecting: { color: "orange", icon: <SyncOutlined spin /> },
  health_ok: { color: "green", icon: <CheckCircleOutlined /> },
  health_fail: { color: "orange", icon: <WarningOutlined /> },
};

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<SelfTestResult[] | null>(null);
  const [testOverall, setTestOverall] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [events, setEvents] = useState<ConnectionEvent[]>([]);

  const load = () => {
    getStats()
      .then((s) => { setStats(s); setError(null); })
      .catch((e) => setError(e.message));
    getConnectionEvents(15)
      .then(setEvents)
      .catch(() => {});
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const handleSelfTest = async () => {
    setTesting(true);
    setTestResults(null);
    try {
      const res = await runSelfTest();
      setTestResults(res.results);
      setTestOverall(res.overall);
    } catch (err: any) {
      setTestResults([{ name: "Self-Test", status: "fail", detail: err.message }]);
      setTestOverall("fail");
    } finally {
      setTesting(false);
    }
  };

  if (error) {
    return <Alert type="error" message="Failed to connect to Gateway" description={error} />;
  }
  if (!stats) {
    return <Spin size="large" style={{ display: "block", marginTop: 80 }} />;
  }

  const statusColor = (s: string) =>
    s === "pass" ? "green" : s === "fail" ? "red" : "orange";

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 24 }}>
        Dashboard
      </Typography.Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Status"
              value={stats.status === "ok" ? "Online" : "Offline"}
              prefix={<CheckCircleOutlined style={{ color: stats.status === "ok" ? "#22c55e" : "#ef4444" }} />}
              valueStyle={{ color: stats.status === "ok" ? "#22c55e" : "#ef4444" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Uptime"
              value={stats.uptimeFormatted}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Providers"
              value={stats.providerCount}
              prefix={<ApiOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Active Tokens"
              value={stats.activeTokenCount}
              prefix={<KeyOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card size="small">
            <Typography.Text type="secondary">Version: </Typography.Text>
            <Typography.Text>{stats.version}</Typography.Text>
            <Typography.Text type="secondary" style={{ marginLeft: 24 }}>Sessions: </Typography.Text>
            <Typography.Text>{stats.sessionCount}</Typography.Text>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {/* Connection Events */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <span>
                <LinkOutlined style={{ marginRight: 8 }} />
                Connection Events
              </span>
            }
            size="small"
            style={{ minHeight: 200 }}
          >
            {events.length === 0 ? (
              <Typography.Text type="secondary">No connection events yet.</Typography.Text>
            ) : (
              <Timeline
                items={events
                  .slice()
                  .reverse()
                  .map((evt) => {
                    const cfg = EVENT_CONFIG[evt.event] ?? { color: "gray", icon: null };
                    const time = new Date(evt.timestamp).toLocaleTimeString();
                    return {
                      color: cfg.color,
                      dot: cfg.icon,
                      children: (
                        <div>
                          <Tag color={cfg.color} style={{ marginRight: 8 }}>
                            {evt.event}
                          </Tag>
                          <Typography.Text strong>{evt.provider}</Typography.Text>
                          <Typography.Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                            {time}
                          </Typography.Text>
                          {evt.detail && (
                            <div>
                              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                {evt.detail.length > 80 ? evt.detail.slice(0, 80) + "..." : evt.detail}
                              </Typography.Text>
                            </div>
                          )}
                        </div>
                      ),
                    };
                  })}
              />
            )}
          </Card>
        </Col>

        {/* Self-Test */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <span>
                <ExperimentOutlined style={{ marginRight: 8 }} />
                Self-Test
                {testOverall && (
                  <Tag color={statusColor(testOverall)} style={{ marginLeft: 12 }}>
                    {testOverall.toUpperCase()}
                  </Tag>
                )}
              </span>
            }
            extra={
              <Button type="primary" loading={testing} onClick={handleSelfTest} size="small">
                Run Test
              </Button>
            }
            size="small"
            style={{ minHeight: 200 }}
          >
            {!testResults && !testing && (
              <Typography.Text type="secondary">
                Click "Run Test" to verify gateway connectivity and provider health.
              </Typography.Text>
            )}
            {testing && <Spin />}
            {testResults && (
              <List
                size="small"
                dataSource={testResults}
                renderItem={(item) => (
                  <List.Item>
                    <Tag color={statusColor(item.status)}>{item.status.toUpperCase()}</Tag>
                    <Typography.Text strong style={{ width: 180, display: "inline-block" }}>
                      {item.name}
                    </Typography.Text>
                    <Typography.Text type="secondary">{item.detail}</Typography.Text>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
