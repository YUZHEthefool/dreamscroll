"use client";
import { useState } from "react";
import { galleryTemplates } from "@/lib/gallery-templates";
import { templateToWorld } from "@/lib/world-template";
import { saveWorld } from "@/lib/store";
import { WorldTemplate } from "@/lib/world-template";

export default function TemplateGallery() {
  const [expanded, setExpanded] = useState<number | null>(null);

  function handleUse(template: WorldTemplate) {
    const world = templateToWorld(template);
    const hasPlot = template.keyNodes.length > 0;
    if (hasPlot && template.protagonist.name !== "待选择") {
      saveWorld(world);
      window.location.href = `/game?worldId=${world.id}`;
    } else {
      sessionStorage.setItem("vibenovel_create_hint", template.worldview);
      window.location.href = "/create";
    }
  }

  if (galleryTemplates.length === 0) {
    return (
      <p className="script-muted-note">画廊模板即将上线，敬请期待。</p>
    );
  }

  return (
    <div className="template-gallery">
      {galleryTemplates.map((t, i) => (
        <div key={i}>
          <div
            className="template-card"
            onClick={() => setExpanded(expanded === i ? null : i)}
          >
            <div className="template-card-title">{t.title}</div>
            <div className="template-card-genre">{t.genre}</div>
            <p className="template-card-preview">
              {t.worldview.slice(0, 120)}...
            </p>
            <div className="template-card-stats">
              {t.protagonist.name !== "待选择"
                ? `主角：${t.protagonist.name} · `
                : "主角：待选择 · "}
              {t.keyNodes.length} 个节点 · {t.endings.length} 种结局
              {t.dimensions && t.dimensions.length > 0
                ? ` · ${t.dimensions.map((d) => d.name).join("/")}`
                : ""}
            </div>
          </div>

          {expanded === i && (
            <div className="template-detail">
              <div className="script-prose">
                <p>{t.worldview}</p>
              </div>
              <div className="script-command-row" style={{ marginTop: 14 }}>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => handleUse(t)}
                >
                  {t.keyNodes.length > 0 && t.protagonist.name !== "待选择"
                    ? "直接开始游戏"
                    : "使用此模板创建"}
                </button>
                <button
                  type="button"
                  className="outline-button"
                  onClick={() => setExpanded(null)}
                >
                  收起
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
