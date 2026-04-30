import {
  WorldSetting,
  Character,
  KeyNode,
  Choice,
  Ending,
  StoryDimension,
  NarrativeOption,
} from "./types";
import { genId } from "./store";

function extractSection(md: string, heading: string): string {
  const headingRe = new RegExp(`^##\\s+${heading}[^\\n]*`, "m");
  const headingMatch = headingRe.exec(md);
  if (!headingMatch) return "";

  const contentStart = headingMatch.index + headingMatch[0].length;
  const rest = md.slice(contentStart);
  const nextH2 = rest.search(/\n##\s/);
  const content = nextH2 >= 0 ? rest.slice(0, nextH2) : rest;
  return content.trim();
}

function extractH1(md: string): string {
  const match = md.match(/^#\s+(.+)/m);
  return match ? match[1].trim() : "未命名世界";
}

function extractField(block: string, label: string): string {
  const pattern = new RegExp(`[-*]\\s*(?:${label})[：:]\\s*(.+)`, "i");
  const match = block.match(pattern);
  return match && match[1] ? match[1].trim() : "";
}

// ── Dimensions ──

function parseDimensions(section: string): StoryDimension[] {
  const dims: StoryDimension[] = [];
  const pattern = /[-*]\s*([^：:]+)[：:]\s*(.+)/g;
  let m;
  while ((m = pattern.exec(section)) !== null) {
    const name = m[1].trim();
    if (name) {
      dims.push({ id: name, name });
    }
  }
  return dims;
}

// ── Key Nodes ──

function parseTriggerConditions(
  block: string
): { dimensionId: string; threshold: number }[] {
  const conditions: { dimensionId: string; threshold: number }[] = [];
  const match = block.match(
    /触发[条件]*[：:]\s*(.+)/i
  );
  if (!match) return conditions;

  const text = match[1];
  const condPattern = /([^\s>=+]+)\s*>=?\s*(\d+)/g;
  let cm;
  while ((cm = condPattern.exec(text)) !== null) {
    conditions.push({
      dimensionId: cm[1].trim(),
      threshold: parseInt(cm[2], 10),
    });
  }
  return conditions;
}

function parseKeyNodesFromSection(
  section: string,
  act: number,
  startIndex: number
): KeyNode[] {
  const nodes: KeyNode[] = [];
  const nodeBlocks = section.split(/^###\s+/m).filter((b) => b.trim());

  for (let i = 0; i < nodeBlocks.length; i++) {
    const block = nodeBlocks[i];
    const titleMatch = block.match(/^(.+?)[\n]/);
    if (!titleMatch) continue;

    const title = titleMatch[1]
      .replace(/^节点\s*\d+[：:]\s*/, "")
      .trim();

    const descMatch = block.match(
      /(?:描述|背景|说明)[：:]\s*([\s\S]*?)(?=(?:触发|选项|[-*]\s+选项)|$)/i
    );
    const description =
      descMatch && descMatch[1] ? descMatch[1].trim() : "";

    const triggerMatch = block.match(/触发[条件]*[：:]\s*(.+)/i);
    const trigger =
      triggerMatch && triggerMatch[1] ? triggerMatch[1].trim() : "";

    const triggerConditions = parseTriggerConditions(block);

    const choices: Choice[] = [];
    const choicePattern = /[-*]\s*选项\s*([A-Za-z\d])[：:]\s*(.+)/gi;
    let cm;
    while ((cm = choicePattern.exec(block)) !== null) {
      choices.push({
        id: `node_${startIndex + i + 1}_${cm[1].toLowerCase()}`,
        text: (cm[2] || "").trim(),
        consequence: "",
      });
    }

    if (choices.length === 0) {
      const bulletPattern =
        /[-*]\s+(?![描触说])((?:选择|接受|拒绝|加入|独自|信任|放弃|合作|对抗|逃离|留下|牺牲|保护|揭露|隐藏).+)/gi;
      let bm;
      let ci = 0;
      while ((bm = bulletPattern.exec(block)) !== null) {
        choices.push({
          id: `node_${startIndex + i + 1}_${"abc"[ci] || ci}`,
          text: (bm[1] || "").trim(),
          consequence: "",
        });
        ci++;
      }
    }

    if (title) {
      nodes.push({
        id: `node_${startIndex + i + 1}`,
        title,
        description,
        act,
        triggerConditions:
          triggerConditions.length > 0 ? triggerConditions : undefined,
        trigger,
        choices:
          choices.length > 0
            ? choices
            : [
                {
                  id: `node_${startIndex + i + 1}_a`,
                  text: "选项A",
                  consequence: "",
                },
                {
                  id: `node_${startIndex + i + 1}_b`,
                  text: "选项B",
                  consequence: "",
                },
              ],
      });
    }
  }
  return nodes;
}

function parseKeyNodesLegacy(section: string): KeyNode[] {
  return parseKeyNodesFromSection(section, 1, 0);
}

function parseEndings(section: string, nodes: KeyNode[]): Ending[] {
  const endings: Ending[] = [];
  const endingBlocks = section.split(/^###\s+/m).filter((b) => b.trim());

  for (let i = 0; i < endingBlocks.length; i++) {
    const block = endingBlocks[i];
    const titleMatch = block.match(/^(.+?)[\n]/);
    if (!titleMatch) continue;

    const title = titleMatch[1]
      .replace(/^结局\s*\d+[：:]\s*/, "")
      .trim();

    const summaryMatch = block.match(
      /(?:概述|描述|说明)[：:]\s*([\s\S]*?)(?=(?:条件|$))/i
    );
    const summary =
      summaryMatch && summaryMatch[1]
        ? summaryMatch[1].trim()
        : block.replace(titleMatch[0], "").trim().split("\n")[0] || "";

    const conditions: { nodeId: string; choiceId: string }[] = [];
    const condMatch = block.match(/条件[：:]\s*(.+)/i);
    if (condMatch) {
      const condText = condMatch[1];
      const refPattern = /节点\s*(\d+)\s*选\s*([A-Ca-c])/g;
      let rm;
      while ((rm = refPattern.exec(condText)) !== null) {
        conditions.push({
          nodeId: `node_${rm[1]}`,
          choiceId: `node_${rm[1]}_${rm[2].toLowerCase()}`,
        });
      }
      if (conditions.length === 0 && nodes.length > 0) {
        conditions.push({
          nodeId: nodes[Math.min(i, nodes.length - 1)]?.id || "node_1",
          choiceId: `node_${Math.min(i + 1, nodes.length)}_a`,
        });
      }
    }

    if (title) {
      endings.push({
        id: `ending_${i + 1}`,
        title,
        summary,
        conditions,
      });
    }
  }
  return endings;
}

// ── Main Parser ──

export function parseWorldMarkdown(md: string): WorldSetting | null {
  const title = extractH1(md);
  const genre =
    extractSection(md, "类型") ||
    extractSection(md, "类别") ||
    "未知类型";
  const worldview = extractSection(md, "世界观");
  const protSection = extractSection(md, "主角");
  const endingSection = extractSection(md, "结局");

  if (!worldview) return null;

  // Parse dimensions
  const dimSection = extractSection(md, "故事维度");
  const dimensions = parseDimensions(dimSection);

  // Parse key nodes: three-act or legacy format
  let keyNodes: KeyNode[] = [];
  const actPattern =
    /^##\s+第([一二三])幕[：:]*\s*(.*)/gm;
  const acts: { act: number; startIdx: number }[] = [];
  let am;
  while ((am = actPattern.exec(md)) !== null) {
    const actNum =
      am[1] === "一" ? 1 : am[1] === "二" ? 2 : 3;
    acts.push({ act: actNum, startIdx: am.index });
  }

  if (acts.length > 0) {
    for (let ai = 0; ai < acts.length; ai++) {
      const start = acts[ai].startIdx;
      const end =
        ai + 1 < acts.length
          ? acts[ai + 1].startIdx
          : md.indexOf("## 结局") > start
            ? md.indexOf("## 结局")
            : md.length;
      const actSection = md.slice(start, end);
      const nodesInAct = parseKeyNodesFromSection(
        actSection,
        acts[ai].act,
        keyNodes.length
      );
      keyNodes.push(...nodesInAct);
    }
  } else {
    const nodeSection = extractSection(md, "关键节点");
    keyNodes = parseKeyNodesLegacy(nodeSection);
  }

  const endings = parseEndings(endingSection, keyNodes);

  const protagonist: Character = protSection
    ? {
        name: extractField(protSection, "姓名|名字") || "无名",
        title:
          extractField(protSection, "头衔|身份|称号") || "旅者",
        appearance: extractField(protSection, "外貌|外表"),
        personality: extractField(protSection, "性格|人格"),
        background: extractField(protSection, "背景|经历|身世"),
        abilities: extractField(protSection, "能力|技能|力量"),
        motivation: extractField(protSection, "动机|目标|追求"),
      }
    : {
        name: "待选择",
        title: "",
        appearance: "",
        personality: "",
        background: "",
        abilities: "",
        motivation: "",
      };

  return {
    id: genId(),
    title,
    genre: genre.split("\n")[0],
    worldview,
    protagonist,
    dimensions: dimensions.length > 0 ? dimensions : undefined,
    keyNodes,
    endings,
    createdAt: Date.now(),
  };
}

// ── Plot Parser (third agent output) ──

export interface PlotData {
  dimensions: StoryDimension[];
  keyNodes: KeyNode[];
  endings: Ending[];
}

export function parsePlotMarkdown(md: string): PlotData | null {
  const dimSection = extractSection(md, "故事维度");
  const dimensions = parseDimensions(dimSection);

  let keyNodes: KeyNode[] = [];
  const actPattern = /^##\s+第([一二三])幕[：:]*\s*(.*)/gm;
  const acts: { act: number; startIdx: number }[] = [];
  let am;
  while ((am = actPattern.exec(md)) !== null) {
    const actNum = am[1] === "一" ? 1 : am[1] === "二" ? 2 : 3;
    acts.push({ act: actNum, startIdx: am.index });
  }

  if (acts.length > 0) {
    for (let ai = 0; ai < acts.length; ai++) {
      const start = acts[ai].startIdx;
      const end =
        ai + 1 < acts.length
          ? acts[ai + 1].startIdx
          : md.indexOf("## 结局") > start
            ? md.indexOf("## 结局")
            : md.length;
      const actSection = md.slice(start, end);
      const nodesInAct = parseKeyNodesFromSection(
        actSection,
        acts[ai].act,
        keyNodes.length
      );
      keyNodes.push(...nodesInAct);
    }
  } else {
    const nodeSection = extractSection(md, "关键节点");
    if (nodeSection) {
      keyNodes = parseKeyNodesFromSection(nodeSection, 1, 0);
    }
  }

  const endingSection = extractSection(md, "结局");
  const endings = parseEndings(endingSection, keyNodes);

  if (keyNodes.length === 0) return null;

  return { dimensions, keyNodes, endings };
}

// ── Protagonist Candidate Parser ──

function parseCandidateFields(
  section: string
): Record<string, string> {
  const fields: Record<string, string> = {};
  const lines = section.split("\n");
  let currentKey = "";
  let currentValue = "";

  for (const line of lines) {
    // Handles: "- 字段：值", "* 字段：值", "**字段**：值", "字段：值", "- **字段**：值"
    const fieldMatch = line.match(
      /^(?:[-*]\s+|\d+[.)]\s+)?\**\s*([^：:*\n]{1,15}?)\s*\**\s*[：:]\s*(.*)/
    );
    if (fieldMatch) {
      if (currentKey) {
        fields[currentKey] = currentValue.trim();
      }
      currentKey = fieldMatch[1].trim();
      currentValue = fieldMatch[2] || "";
    } else if (currentKey && line.trim() && !line.match(/^#{2,}/)) {
      currentValue += "\n" + line;
    }
  }
  if (currentKey) {
    fields[currentKey] = currentValue.trim();
  }

  return fields;
}

export function parseProtagonistCandidates(md: string): Character[] {
  const candidates: Character[] = [];
  const sections = md.split(/^#{2,3}\s+候选[^\n]*/m);

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed || !/姓名|名字/i.test(trimmed)) continue;

    const f = parseCandidateFields(trimmed);
    if (Object.keys(f).length < 2) continue;

    const name = f["姓名"] || f["名字"] || "无名";

    candidates.push({
      name,
      title: f["头衔"] || f["身份"] || f["称号"] || "旅者",
      archetype: f["原型"] || "",
      appearance: f["外貌"] || f["外表"] || "",
      personality: f["性格"] || f["人格"] || "",
      desire: f["渴望"] || "",
      fear: f["恐惧"] || "",
      beliefs: f["信念"] || "",
      abilities: f["能力"] || f["技能"] || "",
      weaknesses: f["弱点"] || f["缺陷"] || "",
      behaviorPatterns: f["行为模式"] || f["行为"] || "",
      background: f["背景"] || f["经历"] || "",
      motivation: f["动机"] || f["目标"] || "",
      vignette: f["定调片段"] || "",
    });
  }

  return candidates;
}

// ── Narrative Text Cleaner ──

export function cleanNarrativeText(response: string): string {
  const idx = response.indexOf("[CHOICES]");
  return (idx >= 0 ? response.slice(0, idx) : response).trim();
}

// ── Choice Response Parser (dedicated choice agent) ──

export function parseChoiceResponse(
  response: string
): NarrativeOption[] {
  const choices: NarrativeOption[] = [];
  const labels = "ABCDEFG";
  let match;

  // Pattern 1: 【A】text  or  [A] text
  const withBracket = /[【\[]([A-Ca-c])[】\]]\s*(.+)/gm;
  while ((match = withBracket.exec(response)) !== null) {
    choices.push({
      label: match[1].toUpperCase(),
      text: match[2].trim().replace(/\s*[{｛][^}｝]*[}｝]\s*$/, ""),
      dimensionId: "",
    });
  }
  if (choices.length >= 2) return choices;

  // Pattern 2: A. text  or  A、text  or  A: text  or  (A) text
  choices.length = 0;
  const letterPrefix =
    /(?:^|\n)\s*(?:\(?([A-Ca-c])\)?[.、:：)\s])\s*(.+)/g;
  while ((match = letterPrefix.exec(response)) !== null) {
    choices.push({
      label: match[1].toUpperCase(),
      text: match[2].trim(),
      dimensionId: "",
    });
  }
  if (choices.length >= 2) return choices;

  // Pattern 3: numbered lines (1. text, 2. text, 3. text)
  choices.length = 0;
  const numbered = /(?:^|\n)\s*(\d+)[.、:：)\s]\s*(.+)/g;
  let idx = 0;
  while ((match = numbered.exec(response)) !== null) {
    choices.push({
      label: labels[idx] || String(idx + 1),
      text: match[2].trim(),
      dimensionId: "",
    });
    idx++;
  }
  if (choices.length >= 2) return choices;

  // Pattern 4: any line starting with dash/bullet (8+ chars)
  choices.length = 0;
  const bullets = /(?:^|\n)\s*[-*•]\s+(.{8,})/g;
  idx = 0;
  while ((match = bullets.exec(response)) !== null && idx < 3) {
    choices.push({
      label: labels[idx],
      text: match[1].trim(),
      dimensionId: "",
    });
    idx++;
  }

  return choices;
}
