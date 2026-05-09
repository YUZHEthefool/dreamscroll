"use client";
import { useEffect, useState } from "react";
import { listWorlds, listGames, deleteWorld, deleteGame } from "@/lib/store";
import { WorldSetting, GameState } from "@/lib/types";
import { downloadStoryMarkdown } from "@/lib/story-export";
import { downloadWorldTemplate } from "@/lib/world-template";

export default function SaveList() {
  const [worlds, setWorlds] = useState<WorldSetting[]>([]);
  const [games, setGames] = useState<GameState[]>([]);

  useEffect(() => {
    setWorlds(listWorlds());
    setGames(listGames());
  }, []);

  function handleDelete(worldId: string) {
    if (!window.confirm("确定要删除这个世界及其所有存档吗？此操作不可撤回。")) return;
    deleteWorld(worldId);
    setWorlds(listWorlds());
    setGames(listGames());
  }

  function handleDeleteGame(gameId: string) {
    if (!window.confirm("确定要删除这个存档吗？此操作不可撤回。")) return;
    deleteGame(gameId);
    setGames(listGames());
  }

  function formatDate(ts: number) {
    return new Date(ts).toLocaleDateString("zh-CN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (worlds.length === 0) {
    return (
      <p className="script-muted-note">
        还没有任何存档。创建一个新世界开始游戏。
      </p>
    );
  }

  return (
    <ul className="save-list">
      {worlds.map((w) => {
        const worldGames = games.filter((g) => g.worldId === w.id);
        return (
          <li key={w.id} className="save-item">
            <div className="save-meta">
              <span>{w.genre}</span>
              <span>{formatDate(w.createdAt)}</span>
            </div>
            <h3 className="save-title">{w.title}</h3>
            <p className="save-summary">
              {w.protagonist?.name || "未知"} - {(w.worldview || "").slice(0, 80)}...
            </p>
            <div className="save-actions">
              {worldGames.length > 0 ? (
                <>
                  <a href={`/game?id=${worldGames[0].id}`} className="primary-button">
                    {worldGames[0].endingReached ? "查看故事" : "继续游戏"}
                  </a>
                  {worldGames[0].endingReached && (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => downloadStoryMarkdown(w, worldGames[0])}
                    >
                      导出故事
                    </button>
                  )}
                  <button
                    type="button"
                    className="outline-button"
                    onClick={() => handleDeleteGame(worldGames[0].id)}
                  >
                    删除存档
                  </button>
                </>
              ) : (
                <a href={`/game?worldId=${w.id}`} className="primary-button">
                  开始游戏
                </a>
              )}
              <button
                type="button"
                className="outline-button"
                onClick={() => downloadWorldTemplate(w)}
              >
                导出模板
              </button>
              <button
                type="button"
                className="outline-button"
                onClick={() => handleDelete(w.id)}
              >
                删除世界
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
