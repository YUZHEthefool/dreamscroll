import { ChatMessage } from "./ai";
import { WorldSetting, GameState } from "./types";

export function worldGenPrompt(userInput: string): ChatMessage[] {
  return [
    {
      role: "system",
      content: `你是 Worldview Architect，一位专业的互动小说世界观构建专家。你的核心理念是"演绎法"——通过扎实的基础设定，让世界自然运转，矛盾与冲突自然产生。

基于用户的创意，**只生成世界观设定**。不要生成主角、剧情节点或结局。

请严格按照以下 Markdown 格式输出，不要添加额外说明文字：

# 世界名称

## 类型
类型标签（如：玄幻/科幻/悬疑/都市奇幻/赛博朋克/克苏鲁）

## 世界观

用800-1200字详细描述这个世界，必须涵盖以下维度：

**世界类型与核心概念**：用一句话概括世界的独特性，然后详细展开。

**物理法则与世界规则**：这个世界如何运转？力量体系、硬性限制和绝对禁忌。

**主要势力与阵营**：至少2-3个对立势力，各自理念、目标、冲突关系。

**社会结构与阶层**：阶层划分、权力结构、普通人的生存状态。

**历史与暗流**：2-3个关键历史事件。当前隐藏的危机或被掩盖的真相。

要求：
1. 世界观要有深度和内在矛盾，能支撑开放叙事
2. 势力间冲突真实可信，有灰色地带
3. **只输出以上三个部分（# 名称、## 类型、## 世界观），不要输出其他内容**`,
    },
    {
      role: "user",
      content: userInput,
    },
  ];
}

export function plotGenPrompt(world: WorldSetting): ChatMessage[] {
  return [
    {
      role: "system",
      content: `你是 Outline Architect，一位专业的互动小说剧情架构师。基于世界观和主角设定，设计三幕剧结构的剧情脉络。

## 世界信息
世界名称：${world.title}
类型：${world.genre}

## 世界观
${world.worldview}

## 主角
${buildCharacterProfile(world.protagonist)}

请严格按照以下 Markdown 格式输出剧情脉络，不要添加额外说明文字：

## 故事维度

定义4个故事维度，每个维度代表一种行动倾向和价值观。格式：

- 维度名：一句话描述

要求：4个维度覆盖不同的行动风格（如勇武/智谋/仁善/权术），互不重叠，与世界观和主角特点契合。

## 第一幕：起（幕名称）

本幕设定故事背景，引入核心冲突。包含2个关键节点。

### 节点1：节点标题
描述：200-300字，详细描述此节点的剧情背景、核心矛盾和抉择的本质。
触发条件：维度名 >= 数值（第一幕阈值建议2-3）
- 选项A：选项文本
- 选项B：选项文本
- 选项C：选项文本

### 节点2：节点标题
（同上格式）

## 第二幕：承转（幕名称）

本幕发展冲突，关系复杂化，真相逐步揭露。包含2个关键节点。

### 节点3：节点标题
描述：...
触发条件：维度名 >= 数值（第二幕阈值建议4-6）
- 选项A/B/C

### 节点4：节点标题
...

## 第三幕：合（幕名称）

本幕走向高潮和结局。包含1-2个关键节点。

### 节点5：节点标题
描述：...
触发条件：维度名 >= 数值（第三幕阈值建议7-9）
- 选项A/B/C

## 结局

### 结局1：结局标题
概述：200-300字的结局描述
条件：节点1选A + 节点3选B（明确需要哪些关键节点选择的组合）

### 结局2：结局标题
（同上格式，共3-5个结局）

要求：
1. 严格三幕剧结构，5-6个关键节点分布在三幕中
2. 触发条件使用「维度名 >= 数值」格式，引用故事维度中的维度名
3. 不同节点应由不同维度触发
4. 关键节点的选择涉及价值观冲突，没有明显的"正确答案"
5. 结局条件使用「节点X选A/B/C」的组合
6. 剧情脉络要契合主角的性格、渴望和恐惧`,
    },
    {
      role: "user",
      content: `为「${world.title}」设计三幕剧剧情脉络。主角是${world.protagonist.name}（${world.protagonist.title}）。`,
    },
  ];
}

export function protagonistGenPrompt(world: WorldSetting): ChatMessage[] {
  return [
    {
      role: "system",
      content: `你是 Character Soul-crafter，一位专业的角色塑造大师。核心理念：基于演绎法，只定义角色初始状态。

基于以下世界观设定，为玩家创建**3个风格迥异的主角候选人**。

## 世界信息
世界名称：${world.title}
类型：${world.genre}

## 世界观
${world.worldview}

## 创建原则
1. 三个候选人必须有**完全不同的角色原型和性格组合**
2. 渴望与恐惧要深入挖掘内在根源
3. 弱点与能力要平衡
4. 候选人的能力和背景必须与世界观逻辑自洽
5. 性格特质要有张力，日常与极端表现有反差

请严格按照以下格式输出3个候选人：

## 候选一

- 姓名：角色名
- 头衔：角色身份/头衔
- 原型：（英雄/反英雄/智者/颠覆者/孤儿/探索者 中选一个）
- 外貌：2-3句外貌描述，突出标志性特征
- 性格：3-5个核心性格关键词，每个关键词后用括号说明日常和极端表现
- 渴望：内心最深的渴求及其根源
- 恐惧：会摧毁角色精神世界的事情及其根源
- 信念：故事开始时坚信什么？信念来源
- 能力：核心能力及来源、掌握程度
- 弱点：致命缺陷及如何被利用
- 行为模式：紧张时的小动作、面对危险的反应、决策风格
- 背景：100-200字，成长环境、关键经历、故事开始前的状态
- 动机：故事开始时的初始驱动力
- 定调片段：200-300字的微型场景，第三人称，展现核心特质和内在矛盾

## 候选二

（同上格式，完全不同的原型和性格）

## 候选三

（同上格式，完全不同的原型和性格）`,
    },
    {
      role: "user",
      content: `请为「${world.title}」这个${world.genre}世界创建3个风格迥异的主角候选人。`,
    },
  ];
}

function buildCharacterProfile(p: WorldSetting["protagonist"]): string {
  return [
    `姓名：${p.name}（${p.title}）`,
    p.archetype ? `角色原型：${p.archetype}` : "",
    `性格特质：${p.personality}`,
    p.desire ? `内心渴望：${p.desire}` : "",
    p.fear ? `深层恐惧：${p.fear}` : "",
    p.beliefs ? `核心信念：${p.beliefs}` : "",
    `背景经历：${p.background}`,
    `能力：${p.abilities}`,
    p.weaknesses ? `弱点与局限：${p.weaknesses}` : "",
    p.behaviorPatterns ? `行为模式：${p.behaviorPatterns}` : "",
    `动机：${p.motivation}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildDimensionInfo(world: WorldSetting, game: GameState): string {
  const dims = world.dimensions || [];
  if (dims.length === 0) return "";

  const values = game.dimensions || {};
  const lines = dims.map(
    (d) => `- ${d.name}：当前值 ${values[d.id] || 0}`
  );
  return `\n## 故事维度（当前积累值）\n${lines.join("\n")}`;
}

export function styleGuideGenPrompt(world: WorldSetting): ChatMessage[] {
  const p = world.protagonist;
  return [
    {
      role: "user",
      content: `你是文风设计专家。为以下互动小说设计文风指南。

世界：${world.title}（${world.genre}）
世界观概要：${world.worldview.slice(0, 500)}
主角：${p.name}（${p.title}），${p.personality}

请输出简洁的文风指南：

## 文风定义
用一句话概括整体文风（如"用冷峻克制中暗藏温情的笔法书写的赛博朋克都市寓言"）

## 核心原则
3-5条必须遵守的写作原则（如视角限制、情感表达方式、描写的服务性）

## 叙事倾向
- 视角：（如第二人称有限视角，锁定主角感知范围）
- 语调：（如客观冷静/主观温暖/讽刺/压抑）
- 节奏：（如快节奏短句推进/舒缓长句铺陈/张弛交替）
- 词汇风格：（如现代都市口语/古典雅致/科技术语混搭）
- 描写优先级：（如 动作细节 > 环境氛围 > 心理活动 > 外貌）

## 场景写作要点
针对本故事的3-4种常见场景类型（如对峙/探索/对话/追逐），每种1-2句写作要点`,
    },
  ];
}

export function dimensionJudgePrompt(
  dimNames: string[],
  playerAction: string
): ChatMessage[] {
  return [
    {
      role: "user",
      content: `维度列表：${dimNames.join("、")}
玩家行动：${playerAction}
这个行动最符合哪个维度？只回答一个维度名称，不要回答其他内容。`,
    },
  ];
}

export function choiceGenPrompt(
  world: WorldSetting,
  gameState: GameState,
  latestNarrative: string
): ChatMessage[] {
  return [
    {
      role: "user",
      content: `你是互动小说的选项生成器。根据下面的情境，给出3个玩家可选的具体行动。

主角：${world.protagonist.name}，${world.protagonist.personality}

情境：
${latestNarrative.slice(-600)}

请直接输出3个选项，每行一个，格式如下：
【A】具体行动描述
【B】具体行动描述
【C】具体行动描述`,
    },
  ];
}

export function narrativePrompt(
  world: WorldSetting,
  gameState: GameState,
  playerInput: string
): ChatMessage[] {
  const recentNarrative = gameState.narrative.slice(-20);
  const narrativeText = recentNarrative
    .map((m) => {
      if (m.role === "player") return `【玩家行动】${m.content}`;
      if (m.role === "narrator") return `【叙事】${m.content}`;
      if (m.role === "npc") return `【${m.speaker}】${m.content}`;
      return `【系统】${m.content}`;
    })
    .join("\n\n");

  const choicesText = gameState.choicesMade
    .map((c) => `- 在「${c.choiceText}」节点选择了该选项`)
    .join("\n");

  const dims = world.dimensions || [];
  const dimNames = dims.map((d) => d.name).join("、");

  const triggeredNodes = gameState.triggeredNodes || [];
  const untriggered = world.keyNodes.filter(
    (n) => !triggeredNodes.includes(n.id)
  );
  const nextNodes = untriggered.slice(0, 2);
  const nodeHints = nextNodes.length > 0
    ? nextNodes
        .map(
          (n) =>
            `- 「${n.title}」（第${n.act || "?"}幕）：${n.description.slice(0, 80)}...`
        )
        .join("\n")
    : "所有关键节点已触发。";

  return [
    {
      role: "system",
      content: `你是一位精通演绎法的互动小说叙事大师。你正在为玩家讲述一个发生在「${world.title}」世界中的故事。

## 演绎法核心
- 角色行动必须符合性格和动机
- 冲突源于设定和立场的自然碰撞
- 尊重世界观规则，不为爽点破坏逻辑

## 世界观
${world.worldview}

## 主角档案
${buildCharacterProfile(world.protagonist)}
${buildDimensionInfo(world, gameState)}

## 已做出的关键选择
${choicesText || "（尚未做出任何关键选择）"}

## 即将到来的关键节点
${nodeHints}

在叙事中自然地为这些节点铺垫氛围和情境，但不要直接告诉玩家节点的存在。
${world.styleGuide ? `\n## 文风指南\n${world.styleGuide}` : ""}

## 叙事规则
1. 用第二人称（"你"）叙事，深度沉浸式体验
2. 每次回复 300-500 字
3. 主角反应必须体现性格档案中的特质
4. 展示而非告知——通过动作和感官细节传达情绪
5. 配角要有独特个性，对话符合身份
6. 不要替玩家做决定
7. 每段叙事结尾留一个悬念或紧张点
8. **只输出叙事正文**，不要生成选项或选择列表`,
    },
    {
      role: "assistant",
      content:
        narrativeText ||
        "（故事即将开始，等待玩家的第一个行动...）",
    },
    {
      role: "user",
      content: playerInput,
    },
  ];
}

export function openingPrompt(world: WorldSetting): ChatMessage[] {
  const dims = world.dimensions || [];
  const dimNames = dims.map((d) => d.name).join("、");

  return [
    {
      role: "system",
      content: `你是一位精通演绎法的互动小说叙事大师。请为「${world.title}」撰写开场白。

## 世界观
${world.worldview}

## 主角档案
${buildCharacterProfile(world.protagonist)}

## 第一幕信息
${world.keyNodes[0] ? `第一个关键节点：「${world.keyNodes[0].title}」` : ""}
${world.styleGuide ? `\n## 文风指南\n${world.styleGuide}` : ""}

## 开场白要求
1. 用第二人称（"你"）叙事
2. 400-600 字
3. 场景先行：建立感官丰富的场景
4. 行动中引入主角：通过动作展现性格，不要"你是XXX"
5. 暗示内在矛盾：让读者感受到主角的渴望或恐惧
6. 埋入世界观：通过细节自然展示世界独特性
7. 制造悬念：结尾引入意外或疑问
8. **只输出叙事正文**，不要生成选项或选择列表`,
    },
    {
      role: "user",
      content: "开始故事。",
    },
  ];
}

export function endingPrompt(
  world: WorldSetting,
  gameState: GameState,
  ending: { title: string; summary: string }
): ChatMessage[] {
  const p = world.protagonist;
  const choicesText = gameState.choicesMade
    .map((c) => `- ${c.choiceText}`)
    .join("\n");

  return [
    {
      role: "system",
      content: `你是一位精通演绎法的互动小说叙事大师。玩家已到达故事的结局。

## 世界观
${world.worldview}

## 主角
${p.name}（${p.title}）
性格：${p.personality}
${p.desire ? `内心渴望：${p.desire}` : ""}
${p.fear ? `深层恐惧：${p.fear}` : ""}
${p.beliefs ? `初始信念：${p.beliefs}` : ""}

## 玩家的关键选择
${choicesText}

## 结局信息
标题：${ending.title}
概要：${ending.summary}

## 结局写作要求
1. 用第二人称叙事，500-800 字
2. 呼应角色弧光：回应主角的渴望、恐惧、信念的变化
3. 选择的回响：呼应每个关键选择，让结局感觉是自然结果
4. 感官与情感并重：用具体场景和细节承载情感
5. 有余韵：不要说透一切，留下想象空间
6. 不要生成 [CHOICES] 选项块`,
    },
    {
      role: "user",
      content: "请撰写结局。",
    },
  ];
}
