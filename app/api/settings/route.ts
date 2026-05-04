import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";

const SETTINGS_PATH = path.join(process.cwd(), "settings.json");

function maskKey(key: string): string {
  if (!key || key.length <= 8) return key ? "****" : "";
  return key.slice(0, 4) + "****" + key.slice(-4);
}

function readFromFile(): Record<string, string> | null {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf-8"));
  } catch {
    return null;
  }
}

function readFromEnv(): Record<string, string> {
  return {
    url: process.env.API_URL || "",
    apiKey: process.env.API_KEY || "",
    model: process.env.API_MODEL || "",
    creationModel: process.env.API_CREATION_MODEL || "",
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
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { url, apiKey, model, creationModel } = body;

  const existing = readFromFile();

  if (!existing) {
    return new Response(
      JSON.stringify({ error: "云端部署模式下无法修改配置，请通过环境变量设置。" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  const updated: Record<string, string> = {
    url: url ?? existing.url ?? "",
    apiKey:
      apiKey && !apiKey.includes("****")
        ? apiKey
        : existing.apiKey ?? "",
    model: model ?? existing.model ?? "",
    creationModel: creationModel ?? existing.creationModel ?? "",
  };

  try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(updated, null, 2), "utf-8");
    return new Response(
      JSON.stringify({
        url: updated.url,
        apiKey: maskKey(updated.apiKey),
        model: updated.model,
        creationModel: updated.creationModel,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: "云端部署模式下无法修改配置，请通过环境变量设置。" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }
}
