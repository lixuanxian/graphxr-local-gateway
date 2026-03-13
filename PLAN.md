# GraphXR Localhost Gateway — 设计评审 & 实施方案

## 一、README 可行性分析

### 设计优点
- 架构定位清晰：浏览器 → localhost Gateway → MCP servers，解决了浏览器无法直接持有凭证/运行 stdio 的问题
- 安全模型合理：Pairing + Token + Origin allowlist + Host header 校验，覆盖了主要攻击面
- GraphDelta 统一返回格式是好的抽象，让前端不需要关心下游数据库差异
- 分阶段推进路线合理

### 需要完善的设计问题

#### 1) Pairing 流程细化
README 只描述了大致流程，缺少以下细节：
- **确认页面**：Gateway 打开本地浏览器 tab 到 `http://127.0.0.1:<port>/pair/confirm?pairingId=xxx`，显示请求来源 Origin、请求的 scopes、verificationCode
- **Token 生成**：使用 crypto.randomBytes(32) 生成不可猜测的 token，绑定 origin + expiresAt
- **Token 存储**：纯内存 Map，进程退出即清除
- **并发配对**：同时只允许一个 pending pairing（防 DoS）

#### 2) MCP Client 集成策略
README 说"调用下游 MCP tools"，但没明确：
- **Transport 优先级**：Phase 1 先支持 stdio（最通用，Spanner Graph MCP server 是 CLI），后续加 Streamable HTTP
- **Tool → GraphDelta 映射**：每个 provider 需要一个 adapter，将 MCP tool 的返回值转换为 GraphDelta 格式
- **Provider 生命周期**：Gateway 启动时 spawn MCP server 子进程，保持连接；Gateway 退出时 kill 子进程

#### 3) CORS 实现注意点
- `http://localhost:9000` 和 `https://localhost:9000` 需同时支持（dev 环境）
- Origin 匹配需要支持通配符子域名（`*.graphxr.com`）
- **DNS Rebinding 防护**：校验 `Host` header 必须是 `127.0.0.1:<port>` 或 `localhost:<port>`

#### 4) GraphDelta Schema 需要确定
README 给了草案，建议固化为 TypeScript 类型：
```ts
interface GraphDelta {
  nodes: Array<{ id: string; type: string; props: Record<string, unknown> }>;
  edges: Array<{ id: string; src: string; dst: string; type: string; props: Record<string, unknown> }>;
  pageInfo?: { cursor?: string; hasMore: boolean };
  summary?: { truncated: boolean; reason?: string; counts?: { nodes: number; edges: number } };
  provenance: { provider: string; dataset: string; tool: string; timestamp: string };
}
```

#### 5) 配置文件格式
README 用了 YAML 草案，建议用 JSON（Node.js 原生支持，无需额外依赖）：
```json
{
  "port": 19285,
  "providers": [
    {
      "name": "spanner-graph",
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@anthropic/spanner-graph-mcp-server"],
      "env": {},
      "datasets": ["myGraph"]
    }
  ]
}
```

---

## 二、实施方案（Phase 0 + Phase 1）

### 技术选型
- **Runtime**: Node.js 20+ / TypeScript 5.x
- **HTTP**: Express 4.x
- **MCP Client**: `@modelcontextprotocol/sdk`
- **构建**: tsup (简单快速)
- **测试**: vitest

### 项目结构
```
local-gateway/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── gateway.config.json          # 下游 MCP servers 配置
├── src/
│   ├── index.ts                 # 入口：加载配置 → 启动 server
│   ├── server.ts                # Express app 创建 + 中间件注册
│   ├── middleware/
│   │   ├── cors.ts              # CORS + Origin allowlist
│   │   ├── auth.ts              # Bearer token 校验
│   │   └── host-guard.ts        # Host header 校验（防 DNS rebinding）
│   ├── routes/
│   │   ├── health.ts            # GET /health
│   │   ├── pair.ts              # POST /pair/start, GET /pair/status, GET /pair/confirm
│   │   ├── catalog.ts           # GET /catalog/providers, /catalog/datasets
│   │   └── graph.ts             # POST /graph/schema, /graph/neighbors, /graph/expand, /graph/query
│   ├── pairing/
│   │   └── pairing-manager.ts   # 配对状态机 + token 生成/验证
│   ├── mcp/
│   │   ├── mcp-manager.ts       # MCP server 进程管理 + 连接池
│   │   ├── provider-registry.ts # Provider 注册表
│   │   └── adapters/
│   │       ├── base-adapter.ts  # MCP tool result → GraphDelta 的基类
│   │       └── spanner.ts       # Spanner Graph 适配器
│   ├── types/
│   │   ├── graph-delta.ts       # GraphDelta 类型定义
│   │   ├── config.ts            # 配置文件类型
│   │   └── api.ts               # API 请求/响应类型
│   └── utils/
│       ├── logger.ts            # 简单日志（审计用）
│       └── open-browser.ts      # 打开浏览器确认页（跨平台）
├── public/
│   └── pair-confirm.html        # 配对确认页面（纯静态 HTML）
└── tests/
    ├── middleware/
    │   └── cors.test.ts
    ├── routes/
    │   ├── health.test.ts
    │   └── pair.test.ts
    └── pairing/
        └── pairing-manager.test.ts
```

### 实施步骤

#### Step 1: 项目初始化
- `npm init`, 安装依赖 (express, @modelcontextprotocol/sdk, typescript, tsup, vitest)
- 配置 tsconfig.json, tsup.config.ts
- 创建 gateway.config.json 模板

#### Step 2: 核心中间件 (Phase 0)
- **cors.ts**: Origin allowlist 匹配（支持通配符子域名），精确回显 Access-Control-Allow-Origin
- **host-guard.ts**: 校验 Host header，拒绝非 127.0.0.1/localhost
- **auth.ts**: 从 Authorization header 提取 Bearer token，验证有效性

#### Step 3: Pairing 系统 (Phase 0)
- **pairing-manager.ts**:
  - `startPairing(origin, scopes)` → 生成 pairingId + verificationCode
  - `getStatus(pairingId)` → pending/approved/denied
  - `approve(pairingId)` → 生成 token，绑定 origin + expiresAt
  - `validateToken(token, origin)` → boolean
  - 自动过期清理（5 分钟未确认自动 deny）
- **pair-confirm.html**: 简单确认页，显示 origin、scopes、verificationCode，Approve/Deny 按钮
- **pair.ts 路由**: POST /pair/start, GET /pair/status, GET /pair/confirm, POST /pair/approve

#### Step 4: Health + Mock Graph (Phase 0)
- **health.ts**: 返回 `{ status: "ok", version, providers: [...] }`
- **graph.ts**: Mock 实现 `/graph/neighbors`，返回硬编码 GraphDelta（验证端到端流程）

#### Step 5: MCP Client 集成 (Phase 1)
- **mcp-manager.ts**:
  - 根据 config 启动下游 MCP server 子进程（stdio transport）
  - 维护 MCP Client 实例池
  - 提供 `listTools(provider)` 和 `callTool(provider, tool, args)` 方法
- **provider-registry.ts**: 管理 provider → MCP Client 的映射

#### Step 6: Provider Adapter (Phase 1)
- **base-adapter.ts**: 定义 `toGraphDelta(toolResult)` 接口
- **spanner.ts**: Spanner Graph MCP server 的结果 → GraphDelta 转换
- 将 graph.ts 路由从 mock 切换到真实 MCP 调用

#### Step 7: Catalog 路由 (Phase 1)
- **catalog.ts**: 从 provider-registry 读取已注册的 providers 和 datasets
- 支持 `GET /catalog/providers` 和 `GET /catalog/datasets?provider=xxx`

#### Step 8: 测试 & 文档
- 中间件单元测试（CORS、auth、host-guard）
- Pairing 流程集成测试
- MCP client mock 测试
- 更新 README 中的启动指南

### 端口选择
建议默认 `19285`（避免与常用端口冲突，GraphXR 前端硬编码或可配置此端口）。

### 安全 checklist
- [x] Origin allowlist + 精确回显
- [x] Host header 校验
- [x] Pairing 配对确认
- [x] Token 绑定 Origin + 有效期
- [x] Rate limiting（基础版：每 IP 每分钟 60 请求）
- [x] 审计日志（本地文件）
