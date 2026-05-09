import { describe, it, expect } from "vitest";
import {
  parseChoiceResponse,
  cleanNarrativeText,
} from "../lib/markdown-parser";

describe("parseChoiceResponse", () => {
  it("parses bracket format 【A】", () => {
    const input = `
【A】主动出击，直面敌人
【B】冷静观察，寻找破绽
【C】与同伴商议对策
    `;
    const choices = parseChoiceResponse(input);
    expect(choices.length).toBe(3);
    expect(choices[0].label).toBe("A");
    expect(choices[0].text).toContain("主动出击");
  });

  it("parses square bracket format [A]", () => {
    const input = `
[A] 主动出击，直面敌人
[B] 冷静观察，寻找破绽
[C] 与同伴商议对策
    `;
    const choices = parseChoiceResponse(input);
    expect(choices.length).toBe(3);
  });

  it("parses letter prefix format A. text", () => {
    const input = `
A. 向前走
B. 向后退
C. 原地不动
    `;
    const choices = parseChoiceResponse(input);
    expect(choices.length).toBe(3);
  });

  it("parses numbered format 1. text", () => {
    const input = `
1. 向前走
2. 向后退
3. 原地不动
    `;
    const choices = parseChoiceResponse(input);
    expect(choices.length).toBe(3);
    expect(choices[0].label).toBe("A");
  });

  it("returns empty array for empty input", () => {
    expect(parseChoiceResponse("")).toEqual([]);
  });

  it("returns empty array for garbage input", () => {
    expect(parseChoiceResponse("no choices here at all")).toEqual([]);
  });

  it("strips dimension tags from bracket format", () => {
    const input = "【A】出击 {勇气}\n【B】观察 {智慧}";
    const choices = parseChoiceResponse(input);
    expect(choices.length).toBe(2);
    expect(choices[0].text).not.toContain("{");
  });
});

describe("cleanNarrativeText", () => {
  it("strips [CHOICES] and everything after", () => {
    const result = cleanNarrativeText(
      "你走进了森林。\n[CHOICES]\nA. 向前\nB. 后退"
    );
    expect(result).toBe("你走进了森林。");
  });

  it("preserves text without [CHOICES]", () => {
    const text = "你走进了黑暗的森林，脚下枯叶沙沙作响。";
    expect(cleanNarrativeText(text)).toBe(text);
  });

  it("handles empty input", () => {
    expect(cleanNarrativeText("")).toBe("");
  });

  it("trims whitespace", () => {
    expect(cleanNarrativeText("  hello  ")).toBe("hello");
  });

  it("handles [CHOICES] at the start", () => {
    const result = cleanNarrativeText("[CHOICES]\nA. 向前");
    expect(result).toBe("");
  });
});
