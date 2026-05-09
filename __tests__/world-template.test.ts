import { describe, it, expect } from "vitest";
import { parseWorldTemplate, worldToTemplate } from "../lib/world-template";
import type { WorldSetting } from "../lib/types";

describe("parseWorldTemplate", () => {
  it("rejects non-JSON", () => {
    expect(parseWorldTemplate("not json")).toBeNull();
  });

  it("rejects missing _vibenovel marker", () => {
    expect(
      parseWorldTemplate(
        JSON.stringify({ title: "Test", worldview: "A world" })
      )
    ).toBeNull();
  });

  it("rejects wrong _vibenovel marker", () => {
    expect(
      parseWorldTemplate(
        JSON.stringify({
          _vibenovel: "wrong",
          title: "Test",
          worldview: "A world",
          protagonist: { name: "X" },
          keyNodes: [],
          endings: [],
        })
      )
    ).toBeNull();
  });

  it("rejects missing title", () => {
    expect(
      parseWorldTemplate(
        JSON.stringify({
          _vibenovel: "world-template",
          worldview: "A world",
          protagonist: { name: "X" },
          keyNodes: [],
          endings: [],
        })
      )
    ).toBeNull();
  });

  it("rejects missing worldview", () => {
    expect(
      parseWorldTemplate(
        JSON.stringify({
          _vibenovel: "world-template",
          title: "Test",
          protagonist: { name: "X" },
          keyNodes: [],
          endings: [],
        })
      )
    ).toBeNull();
  });

  it("rejects non-object protagonist", () => {
    expect(
      parseWorldTemplate(
        JSON.stringify({
          _vibenovel: "world-template",
          title: "Test",
          worldview: "A world",
          protagonist: "not an object",
          keyNodes: [],
          endings: [],
        })
      )
    ).toBeNull();
  });

  it("rejects null protagonist", () => {
    expect(
      parseWorldTemplate(
        JSON.stringify({
          _vibenovel: "world-template",
          title: "Test",
          worldview: "A world",
          protagonist: null,
          keyNodes: [],
          endings: [],
        })
      )
    ).toBeNull();
  });

  it("rejects non-array keyNodes", () => {
    expect(
      parseWorldTemplate(
        JSON.stringify({
          _vibenovel: "world-template",
          title: "Test",
          worldview: "A world",
          protagonist: { name: "X" },
          keyNodes: "not array",
          endings: [],
        })
      )
    ).toBeNull();
  });

  it("rejects non-array endings", () => {
    expect(
      parseWorldTemplate(
        JSON.stringify({
          _vibenovel: "world-template",
          title: "Test",
          worldview: "A world",
          protagonist: { name: "X" },
          keyNodes: [],
          endings: "not array",
        })
      )
    ).toBeNull();
  });

  it("accepts valid template", () => {
    const template = parseWorldTemplate(
      JSON.stringify({
        _vibenovel: "world-template",
        version: 1,
        title: "Test World",
        genre: "Fantasy",
        worldview: "A magical world",
        protagonist: { name: "Hero", title: "Knight" },
        keyNodes: [
          {
            id: "n1",
            title: "Node 1",
            description: "First",
            trigger: "t",
            choices: [],
          },
        ],
        endings: [{ id: "e1", title: "End", summary: "S", conditions: [] }],
      })
    );
    expect(template).not.toBeNull();
    expect(template!.title).toBe("Test World");
    expect(template!.keyNodes).toHaveLength(1);
  });
});

describe("worldToTemplate", () => {
  it("strips id and createdAt from the template", () => {
    const world: WorldSetting = {
      id: "w123",
      title: "Test",
      genre: "Sci-Fi",
      worldview: "Space",
      protagonist: {
        name: "Pilot",
        title: "Ace",
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
    const template = worldToTemplate(world);
    expect(template._vibenovel).toBe("world-template");
    expect(template.version).toBe(1);
    expect((template as unknown as Record<string, unknown>).id).toBeUndefined();
    expect((template as unknown as Record<string, unknown>).createdAt).toBeUndefined();
  });
});
