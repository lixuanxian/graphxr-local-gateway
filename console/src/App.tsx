import { useState } from "react";
import { Layout, Menu, Typography } from "antd";
import {
  DashboardOutlined,
  ApiOutlined,
  KeyOutlined,
  CodeOutlined,
  SettingOutlined,
  PartitionOutlined,
} from "@ant-design/icons";
import Dashboard from "./pages/Dashboard.tsx";
import Providers from "./pages/Providers.tsx";
import Sessions from "./pages/Sessions.tsx";
import GraphExplorer from "./pages/GraphExplorer.tsx";
import SchemaExplorer from "./pages/SchemaExplorer.tsx";
import Settings from "./pages/Settings.tsx";

const { Sider, Content, Header } = Layout;

const menuItems = [
  { key: "dashboard", icon: <DashboardOutlined />, label: "Dashboard" },
  { key: "providers", icon: <ApiOutlined />, label: "Providers" },
  { key: "schema", icon: <PartitionOutlined />, label: "Schema Explorer" },
  { key: "sessions", icon: <KeyOutlined />, label: "Sessions & Tokens" },
  { key: "explorer", icon: <CodeOutlined />, label: "Graph Explorer" },
  { key: "settings", icon: <SettingOutlined />, label: "Settings" },
];

const pages: Record<string, React.ReactNode> = {
  dashboard: <Dashboard />,
  providers: <Providers />,
  schema: <SchemaExplorer />,
  sessions: <Sessions />,
  explorer: <GraphExplorer />,
  settings: <Settings />,
};

export default function App() {
  const [current, setCurrent] = useState("dashboard");

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        width={220}
        style={{
          background: "#141620",
          borderRight: "1px solid #2a2d3a",
        }}
      >
        <div
          style={{
            padding: "20px 16px 12px",
            borderBottom: "1px solid #2a2d3a",
          }}
        >
          <Typography.Text
            strong
            style={{ color: "#fff", fontSize: 15, display: "block" }}
          >
            GraphXR Gateway
          </Typography.Text>
          <Typography.Text style={{ color: "#666", fontSize: 12 }}>
            Console
          </Typography.Text>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[current]}
          onClick={({ key }) => setCurrent(key)}
          items={menuItems}
          style={{ background: "transparent", borderRight: 0, marginTop: 8 }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: "#1a1d27",
            borderBottom: "1px solid #2a2d3a",
            padding: "0 24px",
            display: "flex",
            alignItems: "center",
            height: 48,
          }}
        >
          <Typography.Text style={{ color: "#888", fontSize: 13 }}>
            http://127.0.0.1:19285
          </Typography.Text>
        </Header>
        <Content
          style={{
            padding: 24,
            background: "#0f1117",
            overflow: "auto",
          }}
        >
          {pages[current]}
        </Content>
      </Layout>
    </Layout>
  );
}
