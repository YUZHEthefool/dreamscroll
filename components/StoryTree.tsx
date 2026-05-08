"use client";
import { WorldSetting, GameState } from "@/lib/types";

interface Props {
  world: WorldSetting;
  game: GameState;
}

export default function StoryTree({ world, game }: Props) {
  const triggered = game.triggeredNodes || [];
  const nodes = world.keyNodes;
  const choiceMap = new Map(
    game.choicesMade.map((c) => [c.nodeId, c])
  );

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

        return (
          <div
            key={node.id}
            className={`story-tree-node ${isDone ? "story-tree-done" : ""} ${isNext ? "story-tree-next" : ""}`}
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
            </div>
          </div>
        );
      })}

      {/* Ending */}
      <div
        className={`story-tree-node story-tree-ending ${endingReached ? "story-tree-done" : ""}`}
      >
        <div className="story-tree-marker" />
        <div className="story-tree-body">
          <span className="story-tree-label">
            {endingReached ? `结局：${endingReached.title}` : "结局"}
          </span>
          {!endingReached && (
            <span className="story-tree-hint">
              {world.endings.length} 种可能
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
