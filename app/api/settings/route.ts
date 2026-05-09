import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";

const SETTINGS_PATHS = [
  path.join(process.cwd(), "data", "settings.json"),
  path.join(process.cwd(), "settings.json"),
];

function maskKey(key: string): string {
  if (!key || key.length <= 8) return key ? "****" : "";
  return key.slice(0, 4) + "****" + key.slice(-4);
}

function findSettingsPath(): string {
  for (const p of SETTINGS_PATHS) {
    try {
      fs.accessSync(p);
      return p;
    } catch {}
  }
  return SETTINGS_PATHS[0];
}

function readFromFile(): Record<string, string> | null {
  for (const p of SETTINGS_PATHS) {
    try {
      return JSON.parse(fs.readFileSync(p, "utf-8"));
    } catch {}
  }
  return null;
}

function readFromEnv(): Record<string, string> {
  return {
    url: process.env.API_URL || "",
    apiKey: process.env.API_KEY || "",
    model: process.env.API_MODEL || "",
    creationModel: process.env.API_CREATION_MODEL || "",
    imageUrl: process.env.IMAGE_API_URL || "",
    imageApiKey: process.env.IMAGE_API_KEY || "",
    imageModel: process.env.IMAGE_API_MODEL || "",
    imageApiType: process.env.IMAGE_API_TYPE || "openai",
  };
}

export async function GET() {
  const settings = readFromFile() || readFromEnv();
  return new Response(
    JSON.stringify({
      url: settings.url || "",
      apiKey: maskKey(settings.apiKey || ""),
      model: settings.model || "",
      creationModel: settings.creationModel || settings.model || "",
      imageUrl: settings.imageUrl || "",
      imageApiKey: maskKey(settings.imageApiKey || ""),
      imageModel: settings.imageModel || "",
      imageApiType: settings.imageApiType || "openai",
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}

function isMaskedKey(key: string): boolean {
  return /^.{4}\*{4}.{4}$/.test(key) || key === "****";
}

function isValidUrl(url: string): boolean {
  if (!url) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "请求体不是有效的 JSON" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const url = typeof body.url === "string" ? body.url : undefined;
  const apiKey = typeof body.apiKey === "string" ? body.apiKey : undefined;
  const model = typeof body.model === "string" ? body.model : undefined;
  const creationModel = typeof body.creationModel === "string" ? body.creationModel : undefined;
  const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl : undefined;
  const imageApiKey = typeof body.imageApiKey === "string" ? body.imageApiKey : undefined;
  const imageModel = typeof body.imageModel === "string" ? body.imageModel : undefined;
  const imageApiType = typeof body.imageApiType === "string" ? body.imageApiType : undefined;

  if (url !== undefined && !isValidUrl(url)) {
    return new Response(
      JSON.stringify({ error: "API URL 格式无效，必须是 http:// 或 https:// 开头" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (imageUrl !== undefined && !isValidUrl(imageUrl)) {
    return new Response(
      JSON.stringify({ error: "图像 API URL 格式无效，必须是 http:// 或 https:// 开头" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const existing = readFromFile();

  if (!existing) {
    return new Response(
      JSON.stringify({ error: "无法写入 settings.json，请检查文件权限或通过环境变量配置。" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  const updated: Record<string, string> = {
    url: url ?? existing.url ?? "",
    apiKey:
      apiKey && !isMaskedKey(apiKey)
        ? apiKey
        : existing.apiKey ?? "",
    model: model ?? existing.model ?? "",
    creationModel: creationModel ?? existing.creationModel ?? "",
    imageUrl: imageUrl ?? existing.imageUrl ?? "",
    imageApiKey:
      imageApiKey && !isMaskedKey(imageApiKey)
        ? imageApiKey
        : existing.imageApiKey ?? "",
    imageModel: imageModel ?? existing.imageModel ?? "",
    imageApiType: imageApiType ?? existing.imageApiType ?? "openai",
  };

  try {
    fs.writeFileSync(findSettingsPath(), JSON.stringify(updated, null, 2), "utf-8");
    return new Response(
      JSON.stringify({
        url: updated.url,
        apiKey: maskKey(updated.apiKey),
        model: updated.model,
        creationModel: updated.creationModel,
        imageUrl: updated.imageUrl,
        imageApiKey: maskKey(updated.imageApiKey),
        imageModel: updated.imageModel,
        imageApiType: updated.imageApiType,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: "无法写入 settings.json，请检查文件权限或通过环境变量配置。" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }
}
