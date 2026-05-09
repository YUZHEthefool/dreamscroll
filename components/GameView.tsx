"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { chatCompletionStream } from "@/lib/ai";
import {
  narrativePrompt,
  openingPrompt,
  endingPrompt,
  choiceGenPrompt,
  dimensionJudgePrompt,
  npcExtractPrompt,
  sceneIllustrationPrompt,
  endingIllustrationPrompt,
} from "@/lib/prompts";
import {
  cleanNarrativeText,
  parseChoiceResponse,
} from "@/lib/markdown-parser";
import { downloadStoryMarkdown } from "@/lib/story-export";
import { isImageGenConfigured, generateImage } from "@/lib/image-gen";
import StoryTree from "./StoryTree";
import {
  getWorld,
  getGame,
  saveGame,
  genId,
  saveCheckpoint,
  listCheckpoints,
} from "@/lib/store";
import {
  WorldSetting,
  GameState,
  NarrativeMessage,
  NarrativeOption,
  ChoiceMade,
  KeyNode,
  Ending,
  Checkpoint,
  Character,
} from "@/lib/types";

interface Props {
  gameId?: string;
  worldId?: string;
}

type Phase = "loading" | "playing" | "node" | "ending" | "error";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const AUTO_CP_INTERVAL = 5;
const ILLUSTRATION_INTERVAL = 3;

function checkKeyNodeTrigger(
  w: WorldSetting,
  g: GameState
): KeyNode | null {
  const dims = g.dimensions || {};
  const triggered = g.triggeredNodes || [];

  for (const node of w.keyNodes) {
    if (triggered.includes(node.id)) continue;
    const conditions = node.triggerConditions;
    if (!conditions || conditions.length === 0) continue;
    const met = conditions.every(
      (c) => (dims[c.dimensionId] || 0) >= c.threshold
    );
    if (met) return node;
  }
  return null;
}

function checkEnding(w: WorldSetting, g: GameState): Ending | null {
  for (const ending of w.endings) {
    if (ending.conditions.length === 0) continue;
    const allMet = ending.conditions.every((cond) =>
      g.choicesMade.some(
        (c) => c.nodeId === cond.nodeId && c.choiceId === cond.choiceId
      )
    );
    if (allMet) return ending;
  }

  const triggered = g.triggeredNodes || [];
  if (triggered.length >= w.keyNodes.length && w.keyNodes.length > 0) {
    let bestMatch: Ending | null = null;
    let bestScore = 0;
    for (const ending of w.endings) {
      let score = 0;
      for (const cond of ending.conditions) {
        if (
          g.choicesMade.some(
            (c) =>
              c.nodeId === cond.nodeId && c.choiceId === cond.choiceId
          )
        )
          score++;
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = ending;
      }
    }
    return bestMatch || w.endings[0] || null;
  }

  return null;
}

export default function GameView({ gameId, worldId }: Props) {
  const [world, setWorld] = useState<WorldSetting | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [pendingChoices, setPendingChoices] = useState<
    NarrativeOption[]
  >([]);
  const [loadingChoices, setLoadingChoices] = useState(false);
  const [activeNode, setActiveNode] = useState<KeyNode | null>(null);
  const [freeText, setFreeText] = useState("");
  const [showFreeInput, setShowFreeInput] = useState(false);
  const [error, setError] = useState("");
  const [showCheckpoints, setShowCheckpoints] = useState(false);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [autoCP, setAutoCP] = useState(true);
  const [showRelations, setShowRelations] = useState(false);
  const [showTree, setShowTree] = useState(false);
  const lastActionRef = useRef<{ gameState: GameState; text: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initRef = useRef(false);
  const playerTurnCountRef = useRef(0);
  const narratorCountRef = useRef(0);
  const processingRef = useRef(false);
  const [illustrations, setIllustrations] = useState<Record<number, string>>({});
  const [loadingIllustrations, setLoadingIllustrations] = useState<Set<number>>(new Set());

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    if (gameId) {
      const g = getGame(gameId);
      if (g) {
        const w = getWorld(g.worldId);
        if (w) {
          setWorld(w);
          setGame(g);
          playerTurnCountRef.current = g.narrative.filter(
            (m) => m.role === "player"
          ).length;
          if (g.endingReached) {
            setPhase("ending");
          } else {
            setPhase("playing");
            if (g.pendingChoices && g.pendingChoices.length > 0) {
              setPendingChoices(g.pendingChoices);
            }
          }
          return;
        }
      }
      setError("找不到存档数据");
      setPhase("error");
      return;
    }

    if (worldId) {
      const w = getWorld(worldId);
      if (!w) {
        setError("找不到世界数据");
        setPhase("error");
        return;
      }
      setWorld(w);
      const dims: Record<string, number> = {};
      if (w.dimensions) {
        for (const d of w.dimensions) dims[d.id] = 0;
      }
      const newGame: GameState = {
        id: genId(),
        worldId: w.id,
        currentNodeIndex: 0,
        choicesMade: [],
        narrative: [],
        sideCharacters: [],
        dimensions: dims,
        pendingChoices: [],
        triggeredNodes: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setGame(newGame);
      saveGame(newGame);
      generateOpening(w, newGame);
      return;
    }

    setError("缺少游戏 ID 或世界 ID");
    setPhase("error");
  }, [gameId, worldId]);

  useEffect(() => {
    scrollToBottom();
  }, [game?.narrative.length, streamText, scrollToBottom]);

  // ── NPC extraction ──

  async function extractAndUpdateNPCs(
    g: GameState,
    narrativeText: string
  ): Promise<GameState> {
    try {
      const messages = npcExtractPrompt(narrativeText);
      let response = "";
      for await (const chunk of chatCompletionStream(messages, {
        max_tokens: 256,
      })) {
        response += chunk;
      }
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return g;
      const npcs: { name: string; title: string; delta: number }[] =
        JSON.parse(jsonMatch[0]);
      if (!Array.isArray(npcs) || npcs.length === 0) return g;

      const chars = [...g.sideCharacters];
      for (const npc of npcs) {
        if (!npc.name || typeof npc.name !== "string") continue;
        const existing = chars.find((c) => c.name === npc.name);
        if (existing) {
          existing.affinity = (existing.affinity || 0) + (npc.delta || 0);
          existing.lastSeen = Date.now();
        } else {
          chars.push({
            name: npc.name,
            title: npc.title || "",
            appearance: "",
            personality: "",
            background: "",
            abilities: "",
            motivation: "",
            affinity: npc.delta || 0,
            lastSeen: Date.now(),
          });
        }
      }
      return { ...g, sideCharacters: chars };
    } catch {
      return g;
    }
  }

  // ── Scene illustrations ──

  async function generateSceneIllustration(
    w: WorldSetting,
    narrativeText: string,
    messageIndex: number,
    force = false
  ) {
    if (!force) {
      narratorCountRef.current += 1;
      if (narratorCountRef.current % ILLUSTRATION_INTERVAL !== 1 && narratorCountRef.current !== 1) return;
    }
    if (!(await isImageGenConfigured())) return;
    setLoadingIllustrations((prev) => new Set(prev).add(messageIndex));
    const prompt = sceneIllustrationPrompt(w, narrativeText);
    const url = await generateImage(prompt);
    setLoadingIllustrations((prev) => {
      const next = new Set(prev);
      next.delete(messageIndex);
      return next;
    });
    if (url) {
      setIllustrations((prev) => ({ ...prev, [messageIndex]: url }));
      setGame((prev) => {
        if (!prev) return prev;
        const narrative = [...prev.narrative];
        if (narrative[messageIndex]) {
          narrative[messageIndex] = { ...narrative[messageIndex], illustration: url };
        }
        const updated = { ...prev, narrative };
        saveGame(updated);
        return updated;
      });
    }
  }

  async function generateEndingIllustration(
    w: WorldSetting,
    ending: Ending,
    messageIndex: number
  ) {
    if (!(await isImageGenConfigured())) return;
    setLoadingIllustrations((prev) => new Set(prev).add(messageIndex));
    const prompt = endingIllustrationPrompt(w, ending);
    const url = await generateImage(prompt);
    setLoadingIllustrations((prev) => {
      const next = new Set(prev);
      next.delete(messageIndex);
      return next;
    });
    if (url) {
      setIllustrations((prev) => ({ ...prev, [messageIndex]: url }));
      setGame((prev) => {
        if (!prev) return prev;
        const narrative = [...prev.narrative];
        if (narrative[messageIndex]) {
          narrative[messageIndex] = { ...narrative[messageIndex], illustration: url };
        }
        const updated = { ...prev, narrative };
        saveGame(updated);
        return updated;
      });
    }
  }

  // ── Checkpoints ──

  function autoCheckpoint(g: GameState, label: string) {
    if (!autoCP) return;
    saveCheckpoint(g.id, label, g);
  }

  function handleManualSave() {
    if (!game) return;
    const turn = game.narrative.filter((m) => m.role === "player").length;
    saveCheckpoint(game.id, `手动存档 · 第 ${turn} 回合`, game);
    refreshCheckpoints(game.id);
  }

  function refreshCheckpoints(gameId: string) {
    setCheckpoints(listCheckpoints(gameId));
  }

  function handleRollback(cp: Checkpoint) {
    const restored = { ...cp.snapshot, updatedAt: Date.now() };
    setGame(restored);
    saveGame(restored);
    setPendingChoices(restored.pendingChoices || []);
    setActiveNode(null);
    setShowCheckpoints(false);
    setError("");
    lastActionRef.current = null;
    playerTurnCountRef.current = restored.narrative.filter(
      (m) => m.role === "player"
    ).length;
    if (restored.endingReached) {
      setPhase("ending");
    } else {
      setPhase("playing");
    }
  }

  // ── Choice agent ──

  function fallbackChoices(): NarrativeOption[] {
    return [
      { label: "A", text: "主动采取行动，直面眼前的局面", dimensionId: "" },
      { label: "B", text: "冷静观察周围，寻找更多线索", dimensionId: "" },
      { label: "C", text: "尝试与对方沟通或交涉", dimensionId: "" },
    ];
  }

  async function fetchChoices(
    w: WorldSetting,
    g: GameState,
    narrativeText: string
  ): Promise<NarrativeOption[]> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const messages = choiceGenPrompt(w, g, narrativeText);
        let response = "";
        for await (const chunk of chatCompletionStream(messages, {
          max_tokens: 512,
        })) {
          response += chunk;
        }
        const choices = parseChoiceResponse(response);
        if (choices.length >= 2) return choices;
      } catch {
        // retry
      }
    }
    return fallbackChoices();
  }

  // ── AI generation ──

  async function generateOpening(w: WorldSetting, g: GameState) {
    setStreaming(true);
    setStreamText("");
    try {
      const messages = openingPrompt(w);
      let full = "";
      for await (const chunk of chatCompletionStream(messages)) {
        full += chunk;
        setStreamText(cleanNarrativeText(full));
      }

      const narrativeText = cleanNarrativeText(full);
      const msg: NarrativeMessage = {
        role: "narrator",
        content: narrativeText,
        timestamp: Date.now(),
      };
      const withNarrative = {
        ...g,
        narrative: [...g.narrative, msg],
        updatedAt: Date.now(),
      };
      setGame(withNarrative);
      saveGame(withNarrative);
      autoCheckpoint(withNarrative, "开场");
      setStreaming(false);
      setStreamText("");
      setPhase("playing");

      setLoadingChoices(true);
      const choices = await fetchChoices(w, withNarrative, narrativeText);
      const withChoicesOpening = { ...withNarrative, pendingChoices: choices };
      setGame(withChoicesOpening);
      saveGame(withChoicesOpening);
      setPendingChoices(choices);
      setLoadingChoices(false);

      generateSceneIllustration(w, narrativeText, withNarrative.narrative.length - 1, true).catch(() => {});

      extractAndUpdateNPCs(withChoicesOpening, narrativeText).then((withNPCs) => {
        if (withNPCs !== withChoicesOpening) {
          setGame(prev => {
            if (!prev) return prev;
            const merged = { ...prev, sideCharacters: withNPCs.sideCharacters };
            saveGame(merged);
            return merged;
          });
        }
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "生成开场白失败"
      );
      setPhase("error");
      setStreaming(false);
      setStreamText("");
      setLoadingChoices(false);
    }
  }

  async function generateNarrative(
    g: GameState,
    playerInput: string
  ) {
    if (!world) return;
    lastActionRef.current = { gameState: g, text: playerInput };
    setStreaming(true);
    setStreamText("");
    try {
      const messages = narrativePrompt(world, g, playerInput);
      let full = "";
      for await (const chunk of chatCompletionStream(messages)) {
        full += chunk;
        setStreamText(cleanNarrativeText(full));
      }

      const narrativeText = cleanNarrativeText(full);
      const narratorMsg: NarrativeMessage = {
        role: "narrator",
        content: narrativeText,
        timestamp: Date.now(),
      };
      const withNarrative = {
        ...g,
        narrative: [...g.narrative, narratorMsg],
        updatedAt: Date.now(),
      };
      setGame(withNarrative);
      saveGame(withNarrative);
      setStreaming(false);
      setStreamText("");

      setLoadingChoices(true);
      const choices = await fetchChoices(world, withNarrative, narrativeText);
      const withChoices = { ...withNarrative, pendingChoices: choices };
      setGame(withChoices);
      saveGame(withChoices);
      setPendingChoices(choices);
      setLoadingChoices(false);
      lastActionRef.current = null;

      generateSceneIllustration(world, narrativeText, withNarrative.narrative.length - 1).catch(() => {});

      extractAndUpdateNPCs(withChoices, narrativeText).then((withNPCs) => {
        if (withNPCs !== withChoices) {
          setGame(prev => {
            if (!prev) return prev;
            const merged = { ...prev, sideCharacters: withNPCs.sideCharacters };
            saveGame(merged);
            return merged;
          });
        }
      });
    } catch (err) {
      const errMsg =
        err instanceof Error ? err.message : "AI 响应失败";
      setError(errMsg);
      const sysMsg: NarrativeMessage = {
        role: "system",
        content: `[错误] ${errMsg}`,
        timestamp: Date.now(),
      };
      const errorGame = {
        ...g,
        narrative: [...g.narrative, sysMsg],
        updatedAt: Date.now(),
      };
      setGame(errorGame);
      saveGame(errorGame);
      setStreaming(false);
      setStreamText("");
      setLoadingChoices(false);
    }
  }

  async function handleRetryNarrative() {
    if (!lastActionRef.current || !world || streaming) return;
    const { gameState, text } = lastActionRef.current;
    setError("");
    await generateNarrative(gameState, text);
  }

  async function generateEndingText(
    w: WorldSetting,
    g: GameState,
    ending: Ending
  ) {
    setStreaming(true);
    setStreamText("");
    try {
      const messages = endingPrompt(w, g, ending);
      let full = "";
      for await (const chunk of chatCompletionStream(messages)) {
        full += chunk;
        setStreamText(full);
      }
      const msg: NarrativeMessage = {
        role: "narrator",
        content: full,
        timestamp: Date.now(),
      };
      const updated = {
        ...g,
        narrative: [...g.narrative, msg],
        updatedAt: Date.now(),
      };
      setGame(updated);
      saveGame(updated);
      setPhase("ending");
      generateEndingIllustration(w, ending, updated.narrative.length - 1).catch(() => {});
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "生成结局失败"
      );
      setPhase("ending");
    } finally {
      setStreaming(false);
      setStreamText("");
    }
  }

  // ── Player actions ──

  async function judgeDimension(
    w: WorldSetting,
    actionText: string
  ): Promise<string> {
    const dims = w.dimensions || [];
    if (dims.length === 0) return "";
    const dimNames = dims.map((d) => d.name);
    try {
      const messages = dimensionJudgePrompt(dimNames, actionText);
      let response = "";
      for await (const chunk of chatCompletionStream(messages, {
        max_tokens: 64,
      })) {
        response += chunk;
      }
      const trimmed = response.trim();
      if (dimNames.includes(trimmed)) return trimmed;
      const sorted = [...dimNames].sort((a, b) => b.length - a.length);
      for (const name of sorted) {
        if (trimmed.includes(name)) return name;
      }
    } catch {
      // fallback: no dimension change
    }
    return "";
  }

  async function handlePlayerAction(actionText: string) {
    if (!world || !game || streaming || loadingChoices || processingRef.current) return;
    processingRef.current = true;

    const playerMsg: NarrativeMessage = {
      role: "player",
      content: actionText,
      timestamp: Date.now(),
    };

    setPendingChoices([]);
    setShowFreeInput(false);
    setFreeText("");
    setLoadingChoices(true);

    playerTurnCountRef.current += 1;
    if (playerTurnCountRef.current % AUTO_CP_INTERVAL === 0) {
      autoCheckpoint(game, `第 ${playerTurnCountRef.current} 回合`);
    }

    const judgedDim = await judgeDimension(world, actionText);
    const dims = { ...(game.dimensions || {}) };
    if (judgedDim) {
      dims[judgedDim] = (dims[judgedDim] || 0) + 1;
    }

    let updated: GameState = {
      ...game,
      narrative: [...game.narrative, playerMsg],
      dimensions: dims,
      pendingChoices: [],
      updatedAt: Date.now(),
    };

    setLoadingChoices(false);

    const triggered = checkKeyNodeTrigger(world, updated);
    if (triggered) {
      autoCheckpoint(updated, `节点前：${triggered.title}`);
      const sysMsg: NarrativeMessage = {
        role: "system",
        content: `—— 关键抉择 ——`,
        timestamp: Date.now(),
      };
      updated = {
        ...updated,
        narrative: [...updated.narrative, sysMsg],
      };
      setGame(updated);
      saveGame(updated);
      setActiveNode(triggered);
      setPhase("node");
      processingRef.current = false;
      return;
    }

    setGame(updated);
    saveGame(updated);
    await generateNarrative(updated, actionText);
    processingRef.current = false;
  }

  function handleButtonChoice(choice: NarrativeOption) {
    handlePlayerAction(choice.text);
  }

  function handleFreeText() {
    if (!freeText.trim()) return;
    handlePlayerAction(freeText.trim());
  }

  async function handleNodeChoice(
    choiceId: string,
    choiceText: string
  ) {
    if (!world || !game || !activeNode) return;

    const choice: ChoiceMade = {
      nodeId: activeNode.id,
      choiceId,
      choiceText,
      timestamp: Date.now(),
    };

    const sysMsg: NarrativeMessage = {
      role: "system",
      content: `[关键抉择] ${activeNode.title}\n你选择了：${choiceText}`,
      timestamp: Date.now(),
    };

    const triggered = [
      ...(game.triggeredNodes || []),
      activeNode.id,
    ];

    const updated: GameState = {
      ...game,
      currentNodeIndex: triggered.length,
      choicesMade: [...game.choicesMade, choice],
      narrative: [...game.narrative, sysMsg],
      triggeredNodes: triggered,
      pendingChoices: [],
      updatedAt: Date.now(),
    };

    setGame(updated);
    saveGame(updated);
    autoCheckpoint(updated, `抉择后：${activeNode.title}`);
    setActiveNode(null);

    const ending = checkEnding(world, updated);
    if (ending) {
      const withEnding = { ...updated, endingReached: ending.id };
      setGame(withEnding);
      saveGame(withEnding);
      generateEndingText(world, withEnding, ending);
      return;
    }

    setPhase("playing");
    await generateNarrative(
      updated,
      `[我在关键节点「${activeNode.title}」选择了：${choiceText}]`
    );
  }

  function handleFreeTextKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleFreeText();
    }
  }

  // ── Render ──

  if (phase === "error") {
    return (
      <section className="script-section">
        <p className="inline-error">{error}</p>
        <div className="script-command-row">
          <a href="/" className="primary-button">
            返回首页
          </a>
        </div>
      </section>
    );
  }

  if (phase === "loading" || !world || !game) {
    return (
      <section className="script-section">
        <div className="loading-dots">加载中</div>
      </section>
    );
  }

  const triggeredCount = (game.triggeredNodes || []).length;
  const totalNodes = world.keyNodes.length;
  const dims = world.dimensions || [];

  return (
    <>
      {/* Progress Bar */}
      <div className="news-stat-strip">
        <span>
          节点 {triggeredCount}/{totalNodes}
        </span>
        <span>选择 {game.choicesMade.length} 次</span>
        <span>
          {phase === "ending"
            ? "已完结"
            : phase === "node"
              ? "关键抉择"
              : "探索中"}
          {!streaming && (
            <>
              <button
                type="button"
                className="checkpoint-toggle"
                onClick={() => setShowTree((v) => !v)}
              >
                {showTree ? "关闭脉络" : "脉络"}
              </button>
              <button
                type="button"
                className="checkpoint-toggle"
                onClick={() => {
                  refreshCheckpoints(game.id);
                  setShowCheckpoints((v) => !v);
                }}
              >
                {showCheckpoints ? "关闭回溯" : "回溯"}
              </button>
            </>
          )}
        </span>
      </div>

      {/* Checkpoint Panel */}
      {showCheckpoints && (
        <div className="checkpoint-panel">
          <div className="checkpoint-panel-header">
            <p className="checkpoint-panel-title">存档点</p>
            <div className="checkpoint-actions">
              <button
                type="button"
                className="primary-button"
                onClick={handleManualSave}
                disabled={streaming}
              >
                手动存档
              </button>
              <button
                type="button"
                className={autoCP ? "secondary-button" : "outline-button"}
                onClick={() => setAutoCP((v) => !v)}
              >
                {autoCP ? "自动存档：开" : "自动存档：关"}
              </button>
            </div>
          </div>
          {checkpoints.length === 0 ? (
            <p className="script-muted-note">暂无存档点。点击「手动存档」保存当前进度。</p>
          ) : (
            <ul className="checkpoint-list">
              {[...checkpoints].reverse().map((cp) => (
                <li key={cp.id} className="checkpoint-item">
                  <span className="checkpoint-label">{cp.label}</span>
                  <span className="checkpoint-meta">
                    {new Date(cp.createdAt).toLocaleTimeString("zh-CN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" · "}
                    {cp.snapshot.narrative.length} 段叙事
                  </span>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => handleRollback(cp)}
                  >
                    回溯到此
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Story Tree */}
      {showTree && (
        <div className="checkpoint-panel">
          <p className="checkpoint-panel-title">故事脉络</p>
          <StoryTree world={world} game={game} />
        </div>
      )}

      {/* Dimension Progress */}
      {dims.length > 0 && phase !== "ending" && (
        <div className="dimension-bar">
          {dims.map((d) => (
            <span key={d.id} className="dimension-tag">
              {d.name} {(game.dimensions || {})[d.id] || 0}
            </span>
          ))}
        </div>
      )}

      {/* Relationship Panel Toggle */}
      {game.sideCharacters.length > 0 && phase !== "ending" && (
        <div className="dimension-bar">
          <button
            type="button"
            className="checkpoint-toggle"
            onClick={() => setShowRelations((v) => !v)}
          >
            {showRelations ? "隐藏人物" : `人物关系 (${game.sideCharacters.length})`}
          </button>
        </div>
      )}

      {/* Relationship Panel */}
      {showRelations && game.sideCharacters.length > 0 && (
        <div className="checkpoint-panel">
          <p className="checkpoint-panel-title">人物关系</p>
          <ul className="checkpoint-list">
            {game.sideCharacters.map((c, i) => (
              <li key={i} className="checkpoint-item">
                <span className="checkpoint-label">
                  {c.name}
                  {c.title ? ` · ${c.title}` : ""}
                </span>
                <span className={`relation-badge ${(c.affinity || 0) > 0 ? "relation-positive" : (c.affinity || 0) < 0 ? "relation-negative" : ""}`}>
                  {(c.affinity || 0) > 0 ? "+" : ""}{c.affinity || 0}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Narrative Scroll */}
      <div className="narrative-scroll" ref={scrollRef}>
        {game.narrative.map((msg, i) => (
          <div key={i}>
            <div
              className={`narrative-block ${msg.role === "player" ? "narrative-player" : ""}`}
            >
              <span
                className={`narrative-role narrative-role-${msg.role}`}
              >
                {msg.role === "narrator"
                  ? "叙事"
                  : msg.role === "player"
                    ? (world.protagonist?.name || "主角")
                    : msg.role === "npc"
                      ? msg.speaker
                      : "系统"}
              </span>
              <p className="narrative-content">{msg.content}</p>
            </div>
            {(msg.illustration || illustrations[i]) && (
              <div className="scene-illustration">
                <img
                  src={msg.illustration || illustrations[i]}
                  alt="场景插画"
                  loading="lazy"
                />
              </div>
            )}
            {loadingIllustrations.has(i) && (
              <div className="scene-illustration-loading">生成插画中...</div>
            )}
          </div>
        ))}

        {streaming && streamText && (
          <div className="narrative-block">
            <span className="narrative-role narrative-role-narrator">
              叙事
            </span>
            <p className="narrative-content streaming-cursor">
              {streamText}
            </p>
          </div>
        )}
      </div>

      {/* Key Node Choices (buttons only, no free text) */}
      {phase === "node" && activeNode && (
        <div className="node-indicator">
          <p className="manuscript-kicker">CRITICAL DECISION</p>
          <h3>{activeNode.title}</h3>
          <p>{activeNode.description}</p>
          <div className="narrative-choices">
            {activeNode.choices.map((choice, i) => (
              <button
                key={choice.id}
                className="narrative-choice-btn"
                onClick={() =>
                  handleNodeChoice(choice.id, choice.text)
                }
                disabled={streaming}
              >
                <span className="narrative-choice-label">
                  {ALPHABET[i]}
                </span>
                <span className="narrative-choice-text">
                  {choice.text}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Ending */}
      {phase === "ending" && (
        <div
          className="node-indicator"
          style={{ borderColor: "var(--ink)" }}
        >
          <p className="manuscript-kicker">THE END</p>
          <h3>
            {world.endings.find((e) => e.id === game.endingReached)
              ?.title || "故事结束"}
          </h3>
          {error && <p className="inline-error">{error}</p>}
          <div className="script-command-row">
            <a href="/" className="primary-button">
              返回首页
            </a>
            <a
              href={`/game?worldId=${world.id}`}
              className="secondary-button"
            >
              重新开始
            </a>
            <button
              type="button"
              className="secondary-button"
              onClick={() => downloadStoryMarkdown(world, game)}
            >
              导出故事
            </button>
          </div>
        </div>
      )}

      {/* Regular Choices (3 buttons + optional free text) */}
      {phase === "playing" && !streaming && (
        <div className="narrative-action-area">
          {lastActionRef.current && !loadingChoices && pendingChoices.length === 0 && (
            <div style={{ marginBottom: 14 }}>
              <p className="inline-error">{error || "生成失败"}</p>
              <div className="script-command-row">
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleRetryNarrative}
                >
                  重试
                </button>
              </div>
            </div>
          )}

          {loadingChoices ? (
            <div className="loading-dots">生成选项中</div>
          ) : pendingChoices.length > 0 ? (
            <>
              <p className="narrative-action-header">你选择——</p>
              <div className="narrative-choices">
                {pendingChoices.map((c) => (
                  <button
                    key={c.label}
                    className="narrative-choice-btn"
                    onClick={() => handleButtonChoice(c)}
                    disabled={loadingChoices}
                  >
                    <span className="narrative-choice-label">
                      {c.label}
                    </span>
                    <span className="narrative-choice-text">
                      {c.text}
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {!showFreeInput ? (
            <div className="script-command-row">
              <button
                type="button"
                className="outline-button"
                onClick={() => setShowFreeInput(true)}
              >
                自由行动
              </button>
              <a href="/" className="outline-button">
                返回首页
              </a>
            </div>
          ) : (
            <div style={{ marginTop: 14 }}>
              <textarea
                className="question-box"
                placeholder="描述你的行动...（Enter 发送）"
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                onKeyDown={handleFreeTextKeyDown}
                rows={2}
              />
              <div className="script-command-row">
                <button
                  className="primary-button"
                  onClick={handleFreeText}
                  disabled={!freeText.trim()}
                >
                  发送
                </button>
                <button
                  type="button"
                  className="outline-button"
                  onClick={() => {
                    setShowFreeInput(false);
                    setFreeText("");
                  }}
                >
                  取消
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Streaming indicator */}
      {phase === "playing" && streaming && (
        <div style={{ marginTop: 14 }}>
          <div className="loading-dots">生成中</div>
        </div>
      )}
    </>
  );
}
