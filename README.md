# 织梦录

AI 驱动的开放世界互动小说。描述你脑海中的世界，AI 构建完整世界观、角色和剧情框架，你在其中自由探索并做出关键抉择，书写独属于你的结局。

## 功能特色

- 多 Agent 世界创建：世界观 → 主角候选 → 三幕剧情 → 文风指南，四步自动生成
- 开放叙事 + 关键节点强制分支，多结局系统
- 故事维度系统：行动被 AI 分类到不同维度，累积触发关键节点
- NPC 关系追踪：自动提取出场角色并追踪好感度变化
- 存档回溯：手动/自动存档，可回溯到任意存档点重新分支
- 支持任意 OpenAI 兼容 API（OpenAI、Claude、本地模型等）

## 本地开发

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

| 字段 | 说明 |
|------|------|
| `url` | OpenAI 兼容 API 的基础地址，会自动补全 `/v1/chat/completions` |
| `apiKey` | API 密钥 |
| `model` | 游戏叙事使用的模型 |
| `creationModel` | 世界创建使用的模型（可选，留空则使用 `model`） |

也可以启动后访问 http://localhost:3000/settings 在网页中配置。

## Docker 部署

适合部署到服务器让朋友在线游玩。

### 快速启动

```bash
cd vibenovel/vibenovel-web

# 1. 创建配置文件
mkdir -p data
cp data/settings.json.example data/settings.json
# 编辑 data/settings.json，填入你的 API 信息

# 2. 一键启动
docker compose up -d
```

访问 `http://你的服务器IP:3000` 即可游玩。

### 使用环境变量配置（可选）

如果不想用配置文件，可以通过环境变量传入：

```yaml
# docker-compose.yml
services:
  vibenovel:
    build: .
    ports:
      - "3000:3000"
    environment:
      - API_URL=https://api.openai.com
      - API_KEY=sk-your-api-key
      - API_MODEL=gpt-4o
      - API_CREATION_MODEL=gpt-4o
    restart: unless-stopped
```

配置文件和环境变量同时存在时，配置文件优先。

### 反向代理（推荐）

生产环境建议用 Nginx 反代并配置 HTTPS：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_buffering off;
    }
}
```

`proxy_buffering off` 确保 SSE 流式响应不被缓冲。

### 更新部署

```bash
git pull
docker compose up -d --build
```

### 说明

- 游戏数据保存在玩家浏览器的 localStorage 中，服务端不存储任何游戏数据
- `data/settings.json` 通过 volume 挂载，容器重建后配置不丢失
- 也可以启动后访问 `http://你的服务器IP:3000/settings` 在网页中修改配置
- 2C2G 服务器足够运行，应用本身很轻量，主要开销在 LLM API 调用
