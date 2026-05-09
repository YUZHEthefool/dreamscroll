import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";

interface Settings {
  url: string;
  apiKey: string;
  model: string;
  creationModel?: string;
}

const SETTINGS_PATHS = [
  path.join(process.cwd(), "data", "settings.json"),
  path.join(process.cwd(), "settings.json"),
];

function loadSettings(): Settings {
  for (const p of SETTINGS_PATHS) {
    try {
      return JSON.parse(fs.readFileSync(p, "utf-8"));
    } catch {}
  }
  return {
    url: process.env.API_URL || "",
    apiKey: process.env.API_KEY || "",
    model: process.env.API_MODEL || "",
    creationModel: process.env.API_CREATION_MODEL || "",
  };
}

function buildUrl(base: string): string {
  let u = base.replace(/\/+$/, "");
  if (!u.endsWith("/v1/chat/completions")) {
    if (!u.endsWith("/v1")) u += "/v1";
    u += "/chat/completions";
  }
  return u;
}

export async function POST(req: NextRequest) {
  const settings = loadSettings();

  if (!settings.url || !settings.apiKey) {
    return new Response(
      JSON.stringify({ error: "API 未配置。请设置 settings.json（或环境变量 API_URL / API_KEY）。" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "请求体不是有效的 JSON" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  const url = buildUrl(settings.url);

  const isStream = body.stream !== false;

  const maxTokens = Math.min(Math.max(Number(body.max_tokens) || 8192, 1), 16384);
  const temperature = Math.min(Math.max(Number(body.temperature) ?? 0.8, 0), 2);

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return new Response(
      JSON.stringify({ error: "messages 必须是非空数组" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: body.model || settings.model,
        messages: body.messages,
        temperature,
        max_tokens: maxTokens,
        stream: isStream,
      }),
    });
  } catch {
    return new Response(
      JSON.stringify({ error: "无法连接到 API，请检查 API 配置。" }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!upstream.ok) {
    return new Response(
      JSON.stringify({ error: `API 返回错误 (${upstream.status})` }),
      { status: upstream.status, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!isStream) {
    const data = await upstream.json();
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const reader = upstream.body?.getReader();
  if (!reader) {
    return new Response(
      JSON.stringify({ error: "上游响应体为空" }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  const stream = new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        controller.enqueue(value);
      } catch {
        controller.close();
      }
    },
    cancel() {
      reader.cancel();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
