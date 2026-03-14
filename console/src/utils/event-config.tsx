import {
  LinkOutlined,
  DisconnectOutlined,
  WarningOutlined,
  SyncOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";

export const EVENT_CONFIG: Record<string, { color: string; icon: React.ReactNode }> = {
  connected: { color: "green", icon: <LinkOutlined /> },
  disconnected: { color: "red", icon: <DisconnectOutlined /> },
  error: { color: "red", icon: <WarningOutlined /> },
  reconnecting: { color: "orange", icon: <SyncOutlined spin /> },
  health_ok: { color: "green", icon: <CheckCircleOutlined /> },
  health_fail: { color: "orange", icon: <WarningOutlined /> },
};
