import { WorldSetting, GameState, GameSave, Checkpoint } from "./types";

const WORLDS_KEY = "vibenovel_worlds";
const GAMES_KEY = "vibenovel_games";
const CHECKPOINTS_PREFIX = "vibenovel_cp_";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    console.warn("[vibenovel] localStorage 写入失败，存储空间可能已满。");
    return false;
  }
}

export function listWorlds(): WorldSetting[] {
  return readJson<WorldSetting[]>(WORLDS_KEY, []);
}

export function saveWorld(world: WorldSetting) {
  const worlds = listWorlds();
  const idx = worlds.findIndex((w) => w.id === world.id);
  if (idx >= 0) worlds[idx] = world;
  else worlds.unshift(world);
  safeSetItem(WORLDS_KEY, JSON.stringify(worlds));
}

export function deleteWorld(id: string) {
  const allGames = listGames();
  for (const g of allGames) {
    if (g.worldId === id) deleteCheckpoints(g.id);
  }
  const worlds = listWorlds().filter((w) => w.id !== id);
  safeSetItem(WORLDS_KEY, JSON.stringify(worlds));
  const games = allGames.filter((g) => g.worldId !== id);
  safeSetItem(GAMES_KEY, JSON.stringify(games));
}

export function getWorld(id: string): WorldSetting | undefined {
  return listWorlds().find((w) => w.id === id);
}

export function listGames(): GameState[] {
  return readJson<GameState[]>(GAMES_KEY, []);
}

export function saveGame(game: GameState) {
  const games = listGames();
  const idx = games.findIndex((g) => g.id === game.id);
  if (idx >= 0) games[idx] = game;
  else games.unshift(game);
  safeSetItem(GAMES_KEY, JSON.stringify(games));
}

export function getGame(id: string): GameState | undefined {
  return listGames().find((g) => g.id === id);
}

export function deleteGame(id: string) {
  const games = listGames().filter((g) => g.id !== id);
  safeSetItem(GAMES_KEY, JSON.stringify(games));
  deleteCheckpoints(id);
}

export function getFullSave(gameId: string): GameSave | null {
  const game = getGame(gameId);
  if (!game) return null;
  const world = getWorld(game.worldId);
  if (!world) return null;
  return { world, state: game };
}

export function genId(): string {
  const time = Date.now().toString(36);
  const rand = typeof crypto !== "undefined" && crypto.getRandomValues
    ? Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(36)).join("").slice(0, 12)
    : Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 8);
  return time + rand;
}

// ── Checkpoints ──

function cpKey(gameId: string): string {
  return CHECKPOINTS_PREFIX + gameId;
}

export function listCheckpoints(gameId: string): Checkpoint[] {
  return readJson<Checkpoint[]>(cpKey(gameId), []);
}

export function saveCheckpoint(gameId: string, label: string, snapshot: GameState) {
  const cps = listCheckpoints(gameId);
  cps.push({
    id: genId(),
    gameId,
    label,
    snapshot: JSON.parse(JSON.stringify(snapshot)),
    createdAt: Date.now(),
  });
  safeSetItem(cpKey(gameId), JSON.stringify(cps));
}

export function deleteCheckpoints(gameId: string) {
  localStorage.removeItem(cpKey(gameId));
}
