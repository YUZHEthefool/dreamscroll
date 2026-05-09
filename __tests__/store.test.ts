import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockStorage: Record<string, string> = {};
const mockLocalStorage = {
  getItem: vi.fn((key: string) => mockStorage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    mockStorage[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete mockStorage[key];
  }),
};

Object.defineProperty(globalThis, "localStorage", {
  value: mockLocalStorage,
  writable: true,
});

let store: typeof import("../lib/store");

beforeEach(async () => {
  vi.resetModules();
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  mockLocalStorage.setItem.mockClear();
  mockLocalStorage.getItem.mockClear();
  mockLocalStorage.removeItem.mockClear();
  mockLocalStorage.setItem.mockImplementation((key: string, value: string) => {
    mockStorage[key] = value;
  });
  store = await import("../lib/store");
});

describe("genId", () => {
  it("generates unique IDs", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      ids.add(store.genId());
    }
    expect(ids.size).toBe(1000);
  });

  it("generates IDs with sufficient length", () => {
    const id = store.genId();
    expect(id.length).toBeGreaterThanOrEqual(12);
  });
});

describe("safeSetItem (via saveWorld)", () => {
  it("handles localStorage quota exceeded gracefully", () => {
    mockLocalStorage.setItem.mockImplementation(() => {
      throw new DOMException("QuotaExceededError", "QuotaExceededError");
    });

    const world = {
      id: "w1",
      title: "Test",
      genre: "Fantasy",
      worldview: "A world",
      protagonist: {
        name: "Hero",
        title: "Adventurer",
        appearance: "",
        personality: "",
        background: "",
        abilities: "",
        motivation: "",
      },
      keyNodes: [],
      endings: [],
      createdAt: Date.now(),
    };

    expect(() => store.saveWorld(world)).not.toThrow();
  });

  it("handles localStorage quota exceeded in saveGame", () => {
    mockLocalStorage.setItem.mockImplementation(() => {
      throw new DOMException("QuotaExceededError", "QuotaExceededError");
    });

    const game = {
      id: "g1",
      worldId: "w1",
      currentNodeIndex: 0,
      choicesMade: [],
      narrative: [],
      sideCharacters: [],
      dimensions: {},
      pendingChoices: [],
      triggeredNodes: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    expect(() => store.saveGame(game)).not.toThrow();
  });

  it("handles localStorage quota exceeded in saveCheckpoint", () => {
    mockLocalStorage.setItem.mockImplementation(() => {
      throw new DOMException("QuotaExceededError", "QuotaExceededError");
    });

    const game = {
      id: "g1",
      worldId: "w1",
      currentNodeIndex: 0,
      choicesMade: [],
      narrative: [],
      sideCharacters: [],
      dimensions: {},
      pendingChoices: [],
      triggeredNodes: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    expect(() => store.saveCheckpoint("g1", "test", game)).not.toThrow();
  });
});

describe("CRUD operations", () => {
  const mockWorld = {
    id: "w1",
    title: "TestWorld",
    genre: "Fantasy",
    worldview: "A magical world",
    protagonist: {
      name: "Hero",
      title: "Knight",
      appearance: "",
      personality: "brave",
      background: "noble",
      abilities: "sword",
      motivation: "justice",
    },
    keyNodes: [],
    endings: [],
    createdAt: Date.now(),
  };

  const mockGame = {
    id: "g1",
    worldId: "w1",
    currentNodeIndex: 0,
    choicesMade: [],
    narrative: [],
    sideCharacters: [],
    dimensions: {},
    pendingChoices: [],
    triggeredNodes: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  it("saves and retrieves worlds", () => {
    store.saveWorld(mockWorld);
    const worlds = store.listWorlds();
    expect(worlds).toHaveLength(1);
    expect(worlds[0].id).toBe("w1");
  });

  it("saves and retrieves games", () => {
    store.saveGame(mockGame);
    const games = store.listGames();
    expect(games).toHaveLength(1);
    expect(games[0].id).toBe("g1");
  });

  it("deletes world and its games/checkpoints", () => {
    store.saveWorld(mockWorld);
    store.saveGame(mockGame);
    store.saveCheckpoint("g1", "test", mockGame);
    store.deleteWorld("w1");
    expect(store.listWorlds()).toHaveLength(0);
    expect(store.listGames()).toHaveLength(0);
    expect(mockLocalStorage.removeItem).toHaveBeenCalled();
  });

  it("getFullSave returns null for missing game", () => {
    expect(store.getFullSave("nonexistent")).toBeNull();
  });

  it("readJson handles corrupted localStorage data", () => {
    mockStorage["vibenovel_worlds"] = "{corrupted json";
    const worlds = store.listWorlds();
    expect(worlds).toEqual([]);
  });
});
