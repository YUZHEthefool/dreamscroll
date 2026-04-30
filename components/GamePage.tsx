"use client";
import { useSearchParams } from "next/navigation";
import GameView from "./GameView";

export default function GamePage() {
  const params = useSearchParams();
  const gameId = params.get("id") || undefined;
  const worldId = params.get("worldId") || undefined;

  return (
    <GameView gameId={gameId} worldId={worldId} />
  );
}
