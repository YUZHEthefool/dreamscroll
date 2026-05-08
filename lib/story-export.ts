import { WorldSetting, GameState } from "./types";

export function generateStoryMarkdown(
  world: WorldSetting,
  game: GameState
): string {
  const lines: string[] = [];

  lines.push(`# ${world.title}`);
  lines.push("");
  lines.push(`> ${world.genre} · 主角：${world.protagonist.name}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  for (const msg of game.narrative) {
    switch (msg.role) {
      case "narrator":
        lines.push(msg.content);
        lines.push("");
        break;
      case "player":
        lines.push(`> **${world.protagonist.name}**：${msg.content}`);
        lines.push("");
        break;
      case "npc":
        lines.push(`> **${msg.speaker || "NPC"}**：${msg.content}`);
        lines.push("");
        break;
      case "system":
        if (msg.content.startsWith("[错误]")) continue;
        lines.push(`*${msg.content}*`);
        lines.push("");
        break;
    }
  }

  if (game.endingReached) {
    const ending = world.endings.find((e) => e.id === game.endingReached);
    if (ending) {
      lines.push("---");
      lines.push("");
      lines.push(`## 结局：${ending.title}`);
      lines.push("");
      lines.push(ending.summary);
      lines.push("");
    }
  }

  lines.push("---");
  lines.push("");
  const playerTurns = game.narrative.filter((m) => m.role === "player").length;
  const nodeCount = (game.triggeredNodes || []).length;
  lines.push(
    `*${world.title} · ${playerTurns} 次行动 · ${nodeCount} 个关键节点 · ${game.choicesMade.length} 次关键抉择*`
  );

  return lines.join("\n");
}

export function downloadStoryMarkdown(
  world: WorldSetting,
  game: GameState
) {
  const md = generateStoryMarkdown(world, game);
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${world.title}-故事回顾.md`;
  a.click();
  URL.revokeObjectURL(url);
}
