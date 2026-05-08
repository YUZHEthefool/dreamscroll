import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";

interface ImageSettings {
  imageUrl: string;
  imageApiKey: string;
  imageModel: string;
  imageApiType: string;
}

const SETTINGS_PATHS = [
  path.join(process.cwd(), "data", "settings.json"),
  path.join(process.cwd(), "settings.json"),
];

function loadImageSettings(): ImageSettings {
  for (const p of SETTINGS_PATHS) {
    try {
      const data = JSON.parse(fs.readFileSync(p, "utf-8"));
      return {
        imageUrl: data.imageUrl || "",
        imageApiKey: data.imageApiKey || "",
        imageModel: data.imageModel || "",
        imageApiType: data.imageApiType || "openai",
      };
    } catch {}
  }
  return {
    imageUrl: process.env.IMAGE_API_URL || "",
    imageApiKey: process.env.IMAGE_API_KEY || "",
    imageModel: process.env.IMAGE_API_MODEL || "",
    imageApiType: process.env.IMAGE_API_TYPE || "openai",
  };
}

function buildOpenAIUrl(base: string): string {
  let u = base.replace(/\/+$/, "");
  if (u.endsWith("/v1/images/generations")) return u;
  if (u.endsWith("/v1")) return u + "/images/generations";
  return u + "/v1/images/generations";
}

function buildChatUrl(base: string): string {
  let u = base.replace(/\/+$/, "");
  if (u.endsWith("/v1/chat/completions")) return u;
  if (u.endsWith("/v1")) return u + "/chat/completions";
  return u + "/v1/chat/completions";
}

function buildGoogleUrl(base: string, model: string): string {
  let u = base.replace(/\/+$/, "");
  if (u.includes(":generateContent")) return u;
  if (!u.includes("/v1beta")) u += "/v1beta";
  return `${u}/models/${model}:generateContent`;
}

function toDataUri(base64: string, mime = "image/png"): string {
  if (base64.startsWith("data:")) return base64;
  return `data:${mime};base64,${base64}`;
}

function extractBase64FromChatContent(content: string): string | null {
  const mdMatch = content.match(/!\[.*?\]\((data:image\/[^)]+)\)/);
  if (mdMatch) return mdMatch[1];

  const urlMatch = content.match(/(https?:\/\/[^\s"'\]]+\.(png|jpg|jpeg|webp|gif)[^\s"'\]]*)/i);
  if (urlMatch) return urlMatch[1];

  const b64Match = content.match(/([A-Za-z0-9+/]{100,}={0,2})/);
  if (b64Match) return toDataUri(b64Match[1]);

  return null;
}

async function callOpenAI(
  settings: ImageSettings,
  prompt: string,
  size?: string
): Promise<string> {
  const url = buildOpenAIUrl(settings.imageUrl);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.imageApiKey}`,
    },
    body: JSON.stringify({
      model: settings.imageModel,
      prompt,
      size: size || "1024x1024",
      n: 1,
      response_format: "b64_json",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI Image API error (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const item = data.data?.[0];
  if (item?.url) return item.url;
  if (item?.b64_json) return toDataUri(item.b64_json);
  throw new Error("无法从 OpenAI 响应中提取图片");
}

async function callChat(
  settings: ImageSettings,
  prompt: string
): Promise<string> {
  const url = buildChatUrl(settings.imageUrl);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.imageApiKey}`,
    },
    body: JSON.stringify({
      model: settings.imageModel,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Chat Image API error (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "";
  const extracted = extractBase64FromChatContent(content);
  if (extracted) return extracted;
  throw new Error("无法从 Chat 响应中提取图片");
}

async function callGoogle(
  settings: ImageSettings,
  prompt: string
): Promise<string> {
  const url = buildGoogleUrl(settings.imageUrl, settings.imageModel);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (settings.imageApiKey.startsWith("AIza")) {
    // Google API key style — use query param
  } else {
    headers["Authorization"] = `Bearer ${settings.imageApiKey}`;
  }

  const fetchUrl = settings.imageApiKey.startsWith("AIza")
    ? `${url}?key=${settings.imageApiKey}`
    : url;

  const res = await fetch(fetchUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["IMAGE", "TEXT"],
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Image API error (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      const mime = part.inlineData.mimeType || "image/png";
      return toDataUri(part.inlineData.data, mime);
    }
  }
  throw new Error("无法从 Google 响应中提取图片");
}

export async function POST(req: NextRequest) {
  const settings = loadImageSettings();

  if (!settings.imageUrl) {
    return Response.json({ configured: false });
  }

  if (!settings.imageApiKey) {
    return Response.json(
      { error: "图像 API Key 未配置" },
      { status: 500 }
    );
  }

  const body = await req.json();
  const { prompt, size } = body;

  if (!prompt) {
    return Response.json(
      { error: "缺少 prompt 参数" },
      { status: 400 }
    );
  }

  try {
    let imageUrl: string;
    switch (settings.imageApiType) {
      case "chat":
        imageUrl = await callChat(settings, prompt);
        break;
      case "google":
        imageUrl = await callGoogle(settings, prompt);
        break;
      default:
        imageUrl = await callOpenAI(settings, prompt, size);
        break;
    }
    return Response.json({ url: imageUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "图像生成失败";
    return Response.json({ error: message }, { status: 502 });
  }
}
