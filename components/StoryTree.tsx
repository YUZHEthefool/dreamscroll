"use client";
import { useState } from "react";
import { WorldSetting, GameState } from "@/lib/types";

interface Props {
  world: WorldSetting;
  game: GameState;
}

function buildEndingMap(world: WorldSetting): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const ending of world.endings) {
    for (const cond of ending.conditions) {
      const key = `${cond.nodeId}:${cond.choiceId}`;
      const arr = map.get(key) || [];
      arr.push(ending.id);
      map.set(key, arr);
    }
  }
  return map;
}

export default function StoryTree({ world, game }: Props) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const triggered = game.triggeredNodes || [];
  const nodes = world.keyNodes;
  const choiceMap = new Map(
    game.choicesMade.map((c) => [c.nodeId, c])
  );
  const endingMap = buildEndingMap(world);

  if (nodes.length === 0) {
    return (
      <p className="script-muted-note">该世界没有关键节点数据。</p>
    );
  }

  const endingReached = game.endingReached
    ? world.endings.find((e) => e.id === game.endingReached)
    : null;

  const nextUnlockedIdx = nodes.findIndex(
    (n) => !triggered.includes(n.id)
  );

  function toggleExpand(nodeId: string) {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }

  return (
    <div className="story-tree">
      {/* Opening */}
      <div className="story-tree-node story-tree-done">
        <div className="story-tree-marker" />
        <div className="story-tree-body">
          <span className="story-tree-label">开场</span>
        </div>
      </div>

      {nodes.map((node, i) => {
        const isDone = triggered.includes(node.id);
        const choice = choiceMap.get(node.id);
        const isNext = !isDone && i === nextUnlockedIdx;
        const isExpanded = expandedNodes.has(node.id);
        const hasChoices = node.choices.length > 0;

        return (
          <div key={node.id}>
            <div
              className={`story-tree-node ${isDone ? "story-tree-done" : ""} ${isNext ? "story-tree-next" : ""} ${hasChoices ? "story-tree-expandable" : ""}`}
              onClick={() => hasChoices && toggleExpand(node.id)}
            >
              <div className="story-tree-marker" />
              <div className="story-tree-body">
                <span className="story-tree-label">
                  {node.act ? `第${node.act}幕 · ` : ""}
                  {node.title}
                </span>
                {isDone && choice && (
                  <span className="story-tree-choice">
                    {choice.choiceText}
                  </span>
                )}
                {isNext && (
                  <span className="story-tree-hint">待触发</span>
                )}
                {!isDone && !isNext && (
                  <span className="story-tree-hint">未解锁</span>
                )}
                {hasChoices && (
                  <span className="story-tree-expand-hint">
                    {isExpanded ? "收起" : `${node.choices.length} 个选项`}
                  </span>
                )}
              </div>
            </div>

            {isExpanded && (
              <div className="story-tree-branches">
                {node.choices.map((c) => {
                  const isTaken = choice?.choiceId === c.id;
                  const reachableEndingIds = endingMap.get(`${node.id}:${c.id}`) || [];
                  const reachableEndings = reachableEndingIds
                    .map((eid) => world.endings.find((e) => e.id === eid))
                    .filter(Boolean);

                  return (
                    <div
                      key={c.id}
                      className={`story-tree-branch ${isTaken ? "story-tree-branch-taken" : ""}`}
                    >
                      <div className="story-tree-branch-marker" />
                      <div className="story-tree-branch-body">
                        <span className="story-tree-branch-text">
                          {c.text}
                        </span>
                        {reachableEndings.length > 0 && (
                          <span className="story-tree-branch-endings">
                            {"→ "}
                            {reachableEndings
                              .map((e) => e!.title)
                              .join("、")}
                          </span>
                        )}
                        {isTaken && (
                          <span className="story-tree-branch-taken-badge">
                            已选
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Endings */}
      <div className="story-tree-endings-group">
        {world.endings.map((ending) => (
          <div
            key={ending.id}
            className={`story-tree-node story-tree-ending ${
              ending.id === game.endingReached ? "story-tree-done" : ""
            }`}
          >
            <div className="story-tree-marker" />
            <div className="story-tree-body">
              <span className="story-tree-label">
                {ending.id === game.endingReached
                  ? `结局：${ending.title}`
                  : ending.title}
              </span>
              {ending.id !== game.endingReached && (
                <span className="story-tree-hint">
                  {ending.conditions
                    .map((cond) => {
                      const n = world.keyNodes.find((k) => k.id === cond.nodeId);
                      const ch = n?.choices.find((c) => c.id === cond.choiceId);
                      return n && ch
                        ? `${n.title}→${ch.text.slice(0, 12)}`
                        : null;
                    })
                    .filter(Boolean)
                    .join(" + ") || "条件未知"}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
