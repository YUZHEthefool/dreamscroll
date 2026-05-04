# 织梦录 

AI 驱动的开放世界互动小说。描述你脑海中的世界，AI 构建完整世界观、角色和剧情框架，你在其中自由探索并做出关键抉择，书写独属于你的结局。

## 功能特色

- 多 Agent 世界创建：世界观 → 主角候选 → 三幕剧情 → 文风指南，四步自动生成
- 开放叙事 + 关键节点强制分支，多结局系统
- 故事维度系统：行动被 AI 分类到不同维度，累积触发关键节点
- NPC 关系追踪：自动提取出场角色并追踪好感度变化
- 存档回溯：手动/自动存档，可回溯到任意存档点重新分支
- 支持任意 OpenAI 兼容 API（OpenAI、Claude、本地模型等）

## 本地部署

### 环境要求

- Node.js 18+
- npm

### 安装步骤

```bash
# 1. 克隆仓库
git clone <repo-url>
cd vibenovel/vibenovel-web

# 2. 安装依赖
npm install

# 3. 创建 API 配置文件
cp settings.json.example settings.json
# 编辑 settings.json，填入你的 API 信息（见下方说明）

# 4. 启动开发服务器
npm run dev
```

浏览器访问 http://localhost:3000 即可开始游戏。

### 配置 settings.json

在 `vibenovel-web/` 目录下创建 `settings.json`：

```json
{
  "url": "https://api.openai.com",
  "apiKey": "sk-your-api-key",
  "model": "gpt-4o",
  "creationModel": "gpt-4o"
}
```

| 字段              | 说明                                                            |
| ----------------- | --------------------------------------------------------------- |
| `url`           | OpenAI 兼容 API 的基础地址，会自动补全 `/v1/chat/completions` |
| `apiKey`        | API 密钥                                                        |
| `model`         | 游戏叙事使用的模型                                              |
| `creationModel` | 世界创建使用的模型（可选，留空则使用 `model`）                |

也可以启动后访问 http://localhost:3000/settings 在网页中配置。

### 生产构建

```bash
npm run build    # 构建
npm run start    # 启动生产服务器
```

## 部署到 Cloudflare

将应用部署到 Cloudflare Workers，在线游玩。

### 前置准备

1. 注册 [Cloudflare 账号](https://dash.cloudflare.com/sign-up)
2. 安装依赖（项目已包含 wrangler）：

```bash
cd vibenovel/vibenovel-web
npm install
```

### 部署步骤

```bash
# 1. 登录 Cloudflare
npx wrangler login
# 会打开浏览器完成授权

# 2. 配置 API 信息
# 编辑 wrangler.toml，填入非敏感配置：
```

在 `wrangler.toml` 的 `[vars]` 部分填入：

```toml
[vars]
API_URL = "https://api.openai.com"
API_MODEL = "gpt-4o"
API_CREATION_MODEL = "gpt-4o"
```

```bash
# 3. 设置 API 密钥（作为加密 secret，不会出现在配置文件中）
npx wrangler secret put API_KEY
# 按提示粘贴你的 API Key

# 4. 一键构建并部署
npm run deploy
```

部署完成后会输出访问地址，类似 `https://vibenovel.<your-subdomain>.workers.dev`。

### 自定义域名（可选）

在 Cloudflare Dashboard → Workers → vibenovel → Settings → Domains & Routes 中绑定你自己的域名。

### 更新部署

代码修改后重新运行即可：

```bash
npm run deploy
```

### Cloudflare 部署说明

- 云端模式下 `/settings` 配置页为只读，API 配置通过环境变量管理
- 游戏数据保存在玩家浏览器的 localStorage 中，不同设备间不共享
- 免费版 Cloudflare Workers 有每日 10 万次请求限制，个人分享足够使用
