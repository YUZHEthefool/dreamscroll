"use client";
import { useEffect, useState } from "react";
import { listWorlds, listGames, deleteWorld, deleteGame } from "@/lib/store";
import { WorldSetting, GameState } from "@/lib/types";

export default function SaveList() {
  const [worlds, setWorlds] = useState<WorldSetting[]>([]);
  const [games, setGames] = useState<GameState[]>([]);

  useEffect(() => {
    setWorlds(listWorlds());
    setGames(listGames());
  }, []);

  function handleDelete(worldId: string) {
    deleteWorld(worldId);
    setWorlds(listWorlds());
    setGames(listGames());
  }

  function handleDeleteGame(gameId: string) {
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
              {w.protagonist.name} - {w.worldview.slice(0, 80)}...
            </p>
            <div className="save-actions">
              {worldGames.length > 0 ? (
                <>
                  <a href={`/game?id=${worldGames[0].id}`} className="primary-button">
                    继续游戏
                  </a>
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
