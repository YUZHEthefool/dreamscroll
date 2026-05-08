import { WorldSetting } from "./types";
import { genId } from "./store";

export interface WorldTemplate {
  _vibenovel: "world-template";
  version: 1;
  title: string;
  genre: string;
  worldview: string;
  protagonist: WorldSetting["protagonist"];
  dimensions?: WorldSetting["dimensions"];
  styleGuide?: string;
  keyNodes: WorldSetting["keyNodes"];
  endings: WorldSetting["endings"];
}

export function worldToTemplate(w: WorldSetting): WorldTemplate {
  return {
    _vibenovel: "world-template",
    version: 1,
    title: w.title,
    genre: w.genre,
    worldview: w.worldview,
    protagonist: w.protagonist,
    dimensions: w.dimensions,
    styleGuide: w.styleGuide,
    keyNodes: w.keyNodes,
    endings: w.endings,
  };
}

export function templateToWorld(t: WorldTemplate): WorldSetting {
  return {
    id: genId(),
    title: t.title,
    genre: t.genre,
    worldview: t.worldview,
    protagonist: t.protagonist,
    dimensions: t.dimensions,
    styleGuide: t.styleGuide,
    keyNodes: t.keyNodes,
    endings: t.endings,
    createdAt: Date.now(),
  };
}

export function downloadWorldTemplate(w: WorldSetting) {
  const template = worldToTemplate(w);
  const json = JSON.stringify(template, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${w.title}-世界模板.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseWorldTemplate(text: string): WorldTemplate | null {
  try {
    const obj = JSON.parse(text);
    if (obj._vibenovel !== "world-template") return null;
    if (!obj.title || !obj.worldview) return null;
    if (typeof obj.protagonist !== "object" || !obj.protagonist) return null;
    if (!Array.isArray(obj.keyNodes) || !Array.isArray(obj.endings)) return null;
    return obj as WorldTemplate;
  } catch {
    return null;
  }
}
