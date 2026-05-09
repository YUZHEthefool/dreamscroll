import { describe, it, expect } from "vitest";
import type {
  WorldSetting,
  GameState,
  KeyNode,
  Ending,
} from "../lib/types";

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

const makeWorld = (overrides?: Partial<WorldSetting>): WorldSetting => ({
  id: "w1",
  title: "Test",
  genre: "Fantasy",
  worldview: "A world",
  protagonist: {
    name: "Hero",
    title: "Knight",
    appearance: "",
    personality: "",
    background: "",
    abilities: "",
    motivation: "",
  },
  dimensions: [
    { id: "courage", name: "勇气" },
    { id: "wisdom", name: "智慧" },
  ],
  keyNodes: [
    {
      id: "node1",
      title: "Act 1",
      description: "First node",
      act: 1,
      triggerConditions: [{ dimensionId: "courage", threshold: 3 }],
      trigger: "courage >= 3",
      choices: [
        { id: "c1a", text: "Fight", consequence: "brave" },
        { id: "c1b", text: "Flee", consequence: "cautious" },
      ],
    },
    {
      id: "node2",
      title: "Act 2",
      description: "Second node",
      act: 2,
      triggerConditions: [{ dimensionId: "wisdom", threshold: 3 }],
      trigger: "wisdom >= 3",
      choices: [
        { id: "c2a", text: "Study", consequence: "learned" },
        { id: "c2b", text: "Ignore", consequence: "ignorant" },
      ],
    },
  ],
  endings: [
    {
      id: "end1",
      title: "Hero Ending",
      summary: "You became a hero",
      conditions: [
        { nodeId: "node1", choiceId: "c1a" },
        { nodeId: "node2", choiceId: "c2a" },
      ],
    },
    {
      id: "end2",
      title: "Coward Ending",
      summary: "You fled",
      conditions: [
        { nodeId: "node1", choiceId: "c1b" },
        { nodeId: "node2", choiceId: "c2b" },
      ],
    },
  ],
  createdAt: Date.now(),
  ...overrides,
});

const makeGame = (overrides?: Partial<GameState>): GameState => ({
  id: "g1",
  worldId: "w1",
  currentNodeIndex: 0,
  choicesMade: [],
  narrative: [],
  sideCharacters: [],
  dimensions: { courage: 0, wisdom: 0 },
  pendingChoices: [],
  triggeredNodes: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...overrides,
});

describe("checkKeyNodeTrigger", () => {
  it("returns null when no conditions are met", () => {
    const w = makeWorld();
    const g = makeGame();
    expect(checkKeyNodeTrigger(w, g)).toBeNull();
  });

  it("triggers node when dimension meets threshold", () => {
    const w = makeWorld();
    const g = makeGame({ dimensions: { courage: 3, wisdom: 0 } });
    const result = checkKeyNodeTrigger(w, g);
    expect(result?.id).toBe("node1");
  });

  it("skips already triggered nodes", () => {
    const w = makeWorld();
    const g = makeGame({
      dimensions: { courage: 3, wisdom: 3 },
      triggeredNodes: ["node1"],
    });
    const result = checkKeyNodeTrigger(w, g);
    expect(result?.id).toBe("node2");
  });

  it("returns null when all nodes are triggered", () => {
    const w = makeWorld();
    const g = makeGame({
      dimensions: { courage: 5, wisdom: 5 },
      triggeredNodes: ["node1", "node2"],
    });
    expect(checkKeyNodeTrigger(w, g)).toBeNull();
  });

  it("handles missing dimensions gracefully", () => {
    const w = makeWorld();
    const g = makeGame({ dimensions: undefined });
    expect(checkKeyNodeTrigger(w, g)).toBeNull();
  });

  it("handles nodes without triggerConditions", () => {
    const w = makeWorld({
      keyNodes: [
        {
          id: "node1",
          title: "Manual",
          description: "No conditions",
          trigger: "manual",
          choices: [{ id: "c1", text: "ok", consequence: "ok" }],
        },
      ],
    });
    const g = makeGame();
    expect(checkKeyNodeTrigger(w, g)).toBeNull();
  });
});

describe("checkEnding", () => {
  it("returns null when no endings are matched", () => {
    const w = makeWorld();
    const g = makeGame();
    expect(checkEnding(w, g)).toBeNull();
  });

  it("returns exact match ending", () => {
    const w = makeWorld();
    const g = makeGame({
      choicesMade: [
        { nodeId: "node1", choiceId: "c1a", choiceText: "Fight", timestamp: 1 },
        { nodeId: "node2", choiceId: "c2a", choiceText: "Study", timestamp: 2 },
      ],
      triggeredNodes: ["node1", "node2"],
    });
    const result = checkEnding(w, g);
    expect(result?.id).toBe("end1");
  });

  it("uses best-match fallback when all nodes triggered but no exact match", () => {
    const w = makeWorld();
    const g = makeGame({
      choicesMade: [
        { nodeId: "node1", choiceId: "c1a", choiceText: "Fight", timestamp: 1 },
        { nodeId: "node2", choiceId: "c2b", choiceText: "Ignore", timestamp: 2 },
      ],
      triggeredNodes: ["node1", "node2"],
    });
    const result = checkEnding(w, g);
    expect(result).not.toBeNull();
  });

  it("fallback does not pick ending with zero matching conditions (bestScore starts at 0)", () => {
    const w = makeWorld({
      endings: [
        {
          id: "end_impossible",
          title: "Impossible",
          summary: "Never happens",
          conditions: [
            { nodeId: "node_x", choiceId: "choice_x" },
          ],
        },
      ],
    });
    const g = makeGame({
      choicesMade: [
        { nodeId: "node1", choiceId: "c1a", choiceText: "Fight", timestamp: 1 },
        { nodeId: "node2", choiceId: "c2a", choiceText: "Study", timestamp: 2 },
      ],
      triggeredNodes: ["node1", "node2"],
    });
    const result = checkEnding(w, g);
    expect(result?.id).toBe("end_impossible");
  });

  it("returns null when not all nodes are triggered", () => {
    const w = makeWorld();
    const g = makeGame({
      choicesMade: [
        { nodeId: "node1", choiceId: "c1a", choiceText: "Fight", timestamp: 1 },
      ],
      triggeredNodes: ["node1"],
    });
    const result = checkEnding(w, g);
    expect(result).toBeNull();
  });

  it("skips endings with empty conditions", () => {
    const w = makeWorld({
      endings: [
        { id: "empty_end", title: "Empty", summary: "No conds", conditions: [] },
        ...makeWorld().endings,
      ],
    });
    const g = makeGame({
      choicesMade: [
        { nodeId: "node1", choiceId: "c1a", choiceText: "Fight", timestamp: 1 },
        { nodeId: "node2", choiceId: "c2a", choiceText: "Study", timestamp: 2 },
      ],
      triggeredNodes: ["node1", "node2"],
    });
    const result = checkEnding(w, g);
    expect(result?.id).toBe("end1");
  });
});
