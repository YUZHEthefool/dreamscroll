import { WorldSetting, GameState, GameSave } from "./types";

const WORLDS_KEY = "vibenovel_worlds";
const GAMES_KEY = "vibenovel_games";

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

export function listWorlds(): WorldSetting[] {
  return readJson<WorldSetting[]>(WORLDS_KEY, []);
}

export function saveWorld(world: WorldSetting) {
  const worlds = listWorlds();
  const idx = worlds.findIndex((w) => w.id === world.id);
  if (idx >= 0) worlds[idx] = world;
  else worlds.unshift(world);
  localStorage.setItem(WORLDS_KEY, JSON.stringify(worlds));
}

export function deleteWorld(id: string) {
  const worlds = listWorlds().filter((w) => w.id !== id);
  localStorage.setItem(WORLDS_KEY, JSON.stringify(worlds));
  const games = listGames().filter((g) => g.worldId !== id);
  localStorage.setItem(GAMES_KEY, JSON.stringify(games));
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
  localStorage.setItem(GAMES_KEY, JSON.stringify(games));
}

export function getGame(id: string): GameState | undefined {
  return listGames().find((g) => g.id === id);
}

export function deleteGame(id: string) {
  const games = listGames().filter((g) => g.id !== id);
  localStorage.setItem(GAMES_KEY, JSON.stringify(games));
}

export function getFullSave(gameId: string): GameSave | null {
  const game = getGame(gameId);
  if (!game) return null;
  const world = getWorld(game.worldId);
  if (!world) return null;
  return { world, state: game };
}

export function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
