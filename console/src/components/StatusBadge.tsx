import { Badge } from "antd";

const statusMap: Record<string, { status: "success" | "error" | "warning" | "default"; text: string }> = {
  connected: { status: "success", text: "Connected" },
  disconnected: { status: "default", text: "Disconnected" },
  error: { status: "error", text: "Error" },
  ok: { status: "success", text: "Online" },
  pending: { status: "warning", text: "Pending" },
  approved: { status: "success", text: "Approved" },
  denied: { status: "error", text: "Denied" },
};

export default function StatusBadge({ status }: { status: string }) {
  const cfg = statusMap[status] ?? { status: "default" as const, text: status };
  return <Badge status={cfg.status} text={cfg.text} />;
}
