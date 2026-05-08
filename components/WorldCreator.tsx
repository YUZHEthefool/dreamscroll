"use client";
import { useState, useRef, useEffect } from "react";
import { chatCompletionStream } from "@/lib/ai";
import {
  worldGenPrompt,
  protagonistGenPrompt,
  plotGenPrompt,
  styleGuideGenPrompt,
  worldIllustrationPrompt,
} from "@/lib/prompts";
import {
  parseWorldMarkdown,
  parseProtagonistCandidates,
  parsePlotMarkdown,
} from "@/lib/markdown-parser";
import { saveWorld } from "@/lib/store";
import { isImageGenConfigured, generateImage } from "@/lib/image-gen";
import { WorldSetting, Character } from "@/lib/types";

type Phase =
  | "input"
  | "import"
  | "generating"
  | "generatingProtagonists"
  | "pickProtagonist"
  | "generatingPlot"
  | "preview"
  | "error";

const MAX_RETRIES = 2;

function extractWorldviewPreview(md: string): string {
  const match = md.match(/##\s*世界观\s*\n([\s\S]*?)(?=\n##\s|$)/);
  return match ? match[1].trim().slice(0, 300) : "";
}

export default function WorldCreator() {
  const [phase, setPhase] = useState<Phase>("input");
  const [world, setWorld] = useState<WorldSetting | null>(null);
  const [candidates, setCandidates] = useState<Character[]>([]);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState("");
  const [creationModel, setCreationModel] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const importRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setCreationModel(d.creationModel || ""))
      .catch(() => {});
  }, []);
  const userTextRef = useRef("");
  const rawWorldMdRef = useRef("");
  const rawProtagonistMdRef = useRef("");
  const rawPlotMdRef = useRef("");
  const [worldIllustrations, setWorldIllustrations] = useState<Record<string, string>>({});
  const [generatingImages, setGeneratingImages] = useState(false);

  // ── Export ──

  function handleExport() {
    let content = "";
    if (rawWorldMdRef.current) content += rawWorldMdRef.current;
    if (rawProtagonistMdRef.current) {
      content +=
        "\n\n---PROTAGONIST_DATA---\n\n" + rawProtagonistMdRef.current;
    }
    if (rawPlotMdRef.current) {
      content +=
        "\n\n---PLOT_DATA---\n\n" + rawPlotMdRef.current;
    }
    if (!content) return;
    const blob = new Blob([content], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vibenovel-${world?.title || "world"}-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const hasExportData =
    rawWorldMdRef.current.length > 0 ||
    rawProtagonistMdRef.current.length > 0;

  // ── Import ──

  async function handleImport() {
    const text = importRef.current?.value?.trim();
    if (!text) {
      setError("请粘贴数据");
      setPhase("error");
      return;
    }

    const protSep = "---PROTAGONIST_DATA---";
    const plotSep = "---PLOT_DATA---";

    let worldPart = text;
    let protPart = "";
    let plotPart = "";

    if (text.includes(protSep)) {
      worldPart = text.slice(0, text.indexOf(protSep));
      const afterProt = text.slice(
        text.indexOf(protSep) + protSep.length
      );
      if (afterProt.includes(plotSep)) {
        protPart = afterProt.slice(0, afterProt.indexOf(plotSep));
        plotPart = afterProt.slice(
          afterProt.indexOf(plotSep) + plotSep.length
        );
      } else {
        protPart = afterProt;
      }
    } else if (text.includes(plotSep)) {
      worldPart = text.slice(0, text.indexOf(plotSep));
      plotPart = text.slice(text.indexOf(plotSep) + plotSep.length);
    }

    const parsedWorld = parseWorldMarkdown(worldPart);
    const parsedCandidates = parseProtagonistCandidates(
      protPart || text
    );

    if (!parsedWorld) {
      setError(
        "无法解析世界观数据。请确保包含「# 世界名称」和「## 世界观」等必要结构。"
      );
      setPhase("error");
      return;
    }

    rawWorldMdRef.current = worldPart;

    if (plotPart) {
      const plotData = parsePlotMarkdown(plotPart);
      if (plotData) {
        rawPlotMdRef.current = plotPart;
        parsedWorld.dimensions = plotData.dimensions;
        parsedWorld.keyNodes = plotData.keyNodes;
        parsedWorld.endings = plotData.endings;
      }
    }

    setWorld(parsedWorld);

    if (parsedCandidates.length > 0) {
      rawProtagonistMdRef.current = protPart;
      setCandidates(parsedCandidates);
      setPhase("pickProtagonist");
      return;
    }

    if (parsedWorld.protagonist.name !== "待选择") {
      if (parsedWorld.keyNodes.length > 0) {
        setPhase("preview");
        generateWorldIllustrations(parsedWorld);
      } else {
        await doPlotAndPreview(parsedWorld);
      }
      return;
    }

    setPhase("generatingProtagonists");
    try {
      const chars = await doGenerateProtagonists(parsedWorld, 0);
      setCandidates(chars);
      setPhase("pickProtagonist");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "角色生成失败，请重试。"
      );
      setPhase("error");
    }
  }

  // ── Generation ──

  async function doGenerateWorld(
    text: string,
    attempt: number
  ): Promise<WorldSetting> {
    const messages = worldGenPrompt(text);
    let full = "";
    for await (const chunk of chatCompletionStream(messages, {
      max_tokens: 8192,
      model: creationModel || undefined,
    })) {
      if (chunk) {
        full += chunk;
        const wv = extractWorldviewPreview(full);
        if (wv) setPreview(wv);
      }
    }

    rawWorldMdRef.current = full;

    if (!full || !full.trim()) {
      throw new Error("AI 返回了空内容。");
    }

    const parsed = parseWorldMarkdown(full);
    if (!parsed) {
      if (attempt < MAX_RETRIES) {
        setPreview("解析失败，正在重试...");
        return doGenerateWorld(text, attempt + 1);
      }
      throw new Error(
        "多次尝试后仍无法解析世界数据。你可以导出原始数据手动修正后重新导入。"
      );
    }

    return parsed;
  }

  async function doGenerateProtagonists(
    w: WorldSetting,
    attempt: number
  ): Promise<Character[]> {
    const messages = protagonistGenPrompt(w);
    let full = "";
    for await (const chunk of chatCompletionStream(messages, {
      max_tokens: 8192,
      model: creationModel || undefined,
    })) {
      if (chunk) {
        full += chunk;
      }
    }

    rawProtagonistMdRef.current = full;

    if (!full || !full.trim()) {
      throw new Error("AI 返回了空内容。");
    }

    const parsed = parseProtagonistCandidates(full);
    if (parsed.length === 0) {
      if (attempt < MAX_RETRIES) {
        return doGenerateProtagonists(w, attempt + 1);
      }
      throw new Error(
        "多次尝试后仍无法解析角色数据。你可以导出原始数据手动修正后重新导入。"
      );
    }

    return parsed;
  }

  async function doGeneratePlot(
    w: WorldSetting,
    attempt: number
  ): Promise<{ dimensions: typeof w.dimensions; keyNodes: typeof w.keyNodes; endings: typeof w.endings }> {
    const messages = plotGenPrompt(w);
    let full = "";
    for await (const chunk of chatCompletionStream(messages, {
      model: creationModel || undefined,
      max_tokens: 8192,
    })) {
      if (chunk) {
        full += chunk;
      }
    }

    rawPlotMdRef.current = full;

    if (!full || !full.trim()) {
      throw new Error("AI 返回了空内容。");
    }

    const parsed = parsePlotMarkdown(full);
    if (!parsed) {
      if (attempt < MAX_RETRIES) {
        return doGeneratePlot(w, attempt + 1);
      }
      throw new Error(
        "多次尝试后仍无法解析剧情数据。你可以导出原始数据手动修正后重新导入。"
      );
    }

    return {
      dimensions: parsed.dimensions.length > 0 ? parsed.dimensions : undefined,
      keyNodes: parsed.keyNodes,
      endings: parsed.endings,
    };
  }

  async function doGenerateStyleGuide(
    w: WorldSetting
  ): Promise<string> {
    try {
      const messages = styleGuideGenPrompt(w);
      let full = "";
      for await (const chunk of chatCompletionStream(messages, {
        max_tokens: 2048,
        model: creationModel || undefined,
      })) {
        full += chunk;
      }
      return full.trim();
    } catch {
      return "";
    }
  }

  async function generateWorldIllustrations(w: WorldSetting) {
    if (!(await isImageGenConfigured())) return;
    setGeneratingImages(true);
    const types = ["landscape", "worldmap"] as const;
    await Promise.all(
      types.map(async (type) => {
        const prompt = worldIllustrationPrompt(w, type);
        const url = await generateImage(prompt);
        if (url) {
          setWorldIllustrations((prev) => ({ ...prev, [type]: url }));
        }
      })
    );
    setGeneratingImages(false);
  }

  async function doPlotAndPreview(w: WorldSetting) {
    setPhase("generatingPlot");
    try {
      const [plotData, styleGuide] = await Promise.all([
        doGeneratePlot(w, 0),
        doGenerateStyleGuide(w),
      ]);
      const finalWorld = {
        ...w,
        dimensions: plotData.dimensions,
        keyNodes: plotData.keyNodes,
        endings: plotData.endings,
        styleGuide: styleGuide || undefined,
      };
      setWorld(finalWorld);
      setPhase("preview");
      generateWorldIllustrations(finalWorld);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "剧情生成失败，请重试。"
      );
      setPhase("error");
    }
  }

  async function handleGenerate() {
    const text = inputRef.current?.value?.trim();
    if (!text) {
      setError("请输入世界描述");
      setPhase("error");
      return;
    }
    userTextRef.current = text;
    setPhase("generating");
    setPreview("");
    setError("");
    setCandidates([]);
    rawWorldMdRef.current = "";
    rawProtagonistMdRef.current = "";
    rawPlotMdRef.current = "";

    try {
      const w = await doGenerateWorld(text, 0);
      setWorld(w);

      setPhase("generatingProtagonists");
      setPreview("");

      const chars = await doGenerateProtagonists(w, 0);
      setCandidates(chars);
      setPhase("pickProtagonist");
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失败，请重试。");
      setPhase("error");
    }
  }

  async function handleRetryProtagonists() {
    if (!world) return;
    setPhase("generatingProtagonists");
    setPreview("");
    setError("");

    try {
      const chars = await doGenerateProtagonists(world, 0);
      setCandidates(chars);
      setPhase("pickProtagonist");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "角色生成失败，请重试。"
      );
      setPhase("error");
    }
  }

  async function handlePickProtagonist(character: Character) {
    if (!world) return;
    const updated = { ...world, protagonist: character };
    setWorld(updated);
    await doPlotAndPreview(updated);
  }

  function handleSaveAndPlay() {
    if (!world) return;
    const toSave = Object.keys(worldIllustrations).length > 0
      ? { ...world, illustrations: worldIllustrations }
      : world;
    saveWorld(toSave);
    window.location.href = `/game?worldId=${toSave.id}`;
  }

  function handleRetry() {
    setPhase("input");
    setError("");
    setWorld(null);
    setCandidates([]);
    setPreview("");
    setWorldIllustrations({});
    setGeneratingImages(false);
    rawWorldMdRef.current = "";
    rawProtagonistMdRef.current = "";
    rawPlotMdRef.current = "";
  }

  // ── Render ──

  if (phase === "input") {
    const hint = typeof window !== "undefined"
      ? sessionStorage.getItem("vibenovel_create_hint") || ""
      : "";
    if (hint) sessionStorage.removeItem("vibenovel_create_hint");

    return (
      <section className="script-section">
        <div className="script-section-heading">
          <h2>描述你的世界</h2>
          <p>告诉 AI 你想要什么样的故事世界。</p>
        </div>
        <textarea
          ref={inputRef}
          className="question-box"
          placeholder={
            "在这里描述你的世界创意...\n\n例如：\n- 一个灵气枯竭的末法修仙世界，修士们用科技模拟修行\n- 1920年代的上海滩，混入了克苏鲁神话元素\n- 赛博朋克都市中的武侠江湖\n- 星际时代的校园悬疑故事"
          }
          defaultValue={hint}
          rows={6}
        />
        <div className="script-command-row">
          <button
            type="button"
            className="primary-button"
            onClick={handleGenerate}
          >
            生成世界
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => setPhase("import")}
          >
            导入数据
          </button>
          <a href="/" className="outline-button">
            返回首页
          </a>
        </div>
      </section>
    );
  }

  if (phase === "import") {
    return (
      <section className="script-section">
        <div className="script-section-heading">
          <h2>导入世界数据</h2>
          <p>
            粘贴之前导出的 Markdown 数据，或手动编写符合格式的世界观文档。
          </p>
        </div>
        <textarea
          ref={importRef}
          className="question-box"
          placeholder={
            "将导出的 Markdown 数据粘贴到这里...\n\n必须包含以下结构：\n# 世界名称\n## 类型\n## 世界观\n## 关键节点\n## 结局\n\n如果包含主角候选数据（---PROTAGONIST_DATA--- 分隔），将自动进入角色选择。"
          }
          defaultValue=""
          rows={12}
        />
        <div className="script-command-row">
          <button
            type="button"
            className="primary-button"
            onClick={handleImport}
          >
            解析并导入
          </button>
          <button
            type="button"
            className="outline-button"
            onClick={() => setPhase("input")}
          >
            返回
          </button>
        </div>
      </section>
    );
  }

  if (phase === "generating") {
    return (
      <section className="script-section">
        <div className="script-section-heading">
          <h2>世界构建中</h2>
          <p>AI 正在为你编织世界的经纬...</p>
        </div>
        <div className="loading-dots">构建世界观</div>
        {preview ? (
          <div className="script-prose" style={{ marginTop: 18 }}>
            <p className="streaming-cursor">{preview}</p>
          </div>
        ) : (
          <p className="script-muted-note" style={{ marginTop: 14 }}>
            正在生成世界观、势力格局、关键节点和结局，请耐心等待...
          </p>
        )}
      </section>
    );
  }

  if (phase === "generatingProtagonists") {
    return (
      <section className="script-section">
        <div className="script-section-heading">
          <h2>角色塑造中</h2>
          <p>
            Character Soul-crafter
            正在为你打造3位风格迥异的主角候选人...
          </p>
        </div>
        <div className="loading-dots">创建角色</div>
        {world && (
          <p className="script-muted-note" style={{ marginTop: 14 }}>
            世界「{world.title}
            」已构建完成。正在基于世界观生成主角候选人，每位候选人都有独特的性格、渴望与恐惧...
          </p>
        )}
      </section>
    );
  }

  if (phase === "generatingPlot") {
    return (
      <section className="script-section">
        <div className="script-section-heading">
          <h2>剧情与文风构建中</h2>
          <p>
            Outline Architect 与 Style Guide Expert 正在并行工作...
          </p>
        </div>
        <div className="loading-dots">构建剧情与文风</div>
        {world && (
          <p className="script-muted-note" style={{ marginTop: 14 }}>
            世界「{world.title}」与主角「{world.protagonist.name}
            」已就绪。正在并行生成三幕剧结构和专属文风指南...
          </p>
        )}
      </section>
    );
  }

  if (phase === "error") {
    return (
      <section className="script-section">
        <div className="script-section-heading">
          <h2>生成失败</h2>
        </div>
        <p className="inline-error" style={{ whiteSpace: "pre-wrap" }}>
          {error}
        </p>
        <div className="script-command-row">
          {world ? (
            <button
              type="button"
              className="primary-button"
              onClick={handleRetryProtagonists}
            >
              重新生成角色
            </button>
          ) : null}
          <button
            type="button"
            className={world ? "secondary-button" : "primary-button"}
            onClick={handleRetry}
          >
            重新开始
          </button>
          {hasExportData && (
            <button
              type="button"
              className="secondary-button"
              onClick={handleExport}
            >
              导出原始数据
            </button>
          )}
          <a href="/" className="outline-button">
            返回首页
          </a>
        </div>
      </section>
    );
  }

  if (phase === "pickProtagonist") {
    return (
      <>
        <section className="script-section">
          <div className="script-section-heading">
            <h2>选择你的主角</h2>
            <p>
              世界「{world?.title}
              」已就绪。以下是3位候选主角，选择你想要扮演的角色。
            </p>
          </div>
        </section>

        <div className="character-grid">
          {candidates.map((c, i) => (
            <div
              key={i}
              className="character-card"
              onClick={() => handlePickProtagonist(c)}
            >
              <div className="character-card-header">
                <h3 className="character-card-name">{c.name}</h3>
                <span className="character-card-archetype">
                  {c.archetype || c.title}
                </span>
              </div>

              <p className="character-card-title">{c.title}</p>

              <p className="character-card-field">
                <span className="script-label">性格</span>
                {c.personality}
              </p>

              {c.desire && (
                <p className="character-card-field">
                  <span className="script-label">渴望</span>
                  {c.desire}
                </p>
              )}

              {c.fear && (
                <p className="character-card-field">
                  <span className="script-label">恐惧</span>
                  {c.fear}
                </p>
              )}

              {c.abilities && (
                <p className="character-card-field">
                  <span className="script-label">能力</span>
                  {c.abilities}
                </p>
              )}

              {c.weaknesses && (
                <p className="character-card-field">
                  <span className="script-label">弱点</span>
                  {c.weaknesses}
                </p>
              )}

              {c.vignette && (
                <div className="character-card-vignette">{c.vignette}</div>
              )}

              <div className="character-card-cta">[ 选择此角色 ]</div>
            </div>
          ))}
        </div>

        <div className="script-command-row" style={{ marginTop: 24 }}>
          <button
            type="button"
            className="secondary-button"
            onClick={handleRetryProtagonists}
          >
            重新生成角色
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={handleExport}
          >
            导出数据
          </button>
          <a href="/" className="outline-button">
            返回首页
          </a>
        </div>
      </>
    );
  }

  if (phase === "preview" && world) {
    const p = world.protagonist;
    return (
      <>
        <section className="script-section">
          <div className="script-section-heading">
            <h2>{world.title}</h2>
            <p>{world.genre}</p>
          </div>
          <div className="script-prose" style={{ marginTop: 12 }}>
            <p>{world.worldview}</p>
          </div>
        </section>

        {(Object.keys(worldIllustrations).length > 0 || generatingImages) && (
          <section className="script-section">
            <div className="script-section-heading">
              <h2>世界插画</h2>
            </div>
            <div className="world-illustrations">
              {worldIllustrations.landscape ? (
                <div className="scene-illustration">
                  <img src={worldIllustrations.landscape} alt="世界全景" />
                  <span className="illustration-caption">世界全景</span>
                </div>
              ) : generatingImages ? (
                <div className="scene-illustration-loading">生成全景图中...</div>
              ) : null}
              {worldIllustrations.worldmap ? (
                <div className="scene-illustration">
                  <img src={worldIllustrations.worldmap} alt="世界地图" />
                  <span className="illustration-caption">世界地图</span>
                </div>
              ) : generatingImages ? (
                <div className="scene-illustration-loading">生成地图中...</div>
              ) : null}
            </div>
          </section>
        )}

        <section className="script-section">
          <div className="script-section-heading">
            <h2>主角</h2>
            <p>
              {p.name} — {p.title}
              {p.archetype ? ` / ${p.archetype}` : ""}
            </p>
          </div>
          <div className="script-prose" style={{ marginTop: 12 }}>
            {p.appearance && (
              <p>
                <span className="script-label">外貌</span>
                {p.appearance}
              </p>
            )}
            <p>
              <span className="script-label">性格</span>
              {p.personality}
            </p>
            {p.desire && (
              <p>
                <span className="script-label">渴望</span>
                {p.desire}
              </p>
            )}
            {p.fear && (
              <p>
                <span className="script-label">恐惧</span>
                {p.fear}
              </p>
            )}
            {p.beliefs && (
              <p>
                <span className="script-label">信念</span>
                {p.beliefs}
              </p>
            )}
            <p>
              <span className="script-label">背景</span>
              {p.background}
            </p>
            <p>
              <span className="script-label">能力</span>
              {p.abilities}
            </p>
            {p.weaknesses && (
              <p>
                <span className="script-label">弱点</span>
                {p.weaknesses}
              </p>
            )}
            {p.behaviorPatterns && (
              <p>
                <span className="script-label">行为</span>
                {p.behaviorPatterns}
              </p>
            )}
            <p>
              <span className="script-label">动机</span>
              {p.motivation}
            </p>
            {p.vignette && (
              <div className="character-card-vignette">{p.vignette}</div>
            )}
          </div>
        </section>

        <section className="script-section">
          <div className="script-prose" style={{ marginTop: 12 }}>
            <p className="script-muted-note">
              三幕剧结构已就绪：{world.keyNodes.length} 个关键决策点，
              {world.endings.length} 种可能的结局。剧情将在游戏中自然展开。
            </p>
          </div>
        </section>

        <div className="script-command-row" style={{ marginTop: 24 }}>
          <button
            type="button"
            className="primary-button"
            onClick={handleSaveAndPlay}
          >
            保存并开始游戏
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => setPhase("pickProtagonist")}
          >
            重新选择主角
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={handleExport}
          >
            导出数据
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={handleRetry}
          >
            重新生成
          </button>
          <a href="/" className="outline-button">
            返回首页
          </a>
        </div>
      </>
    );
  }

  return null;
}
