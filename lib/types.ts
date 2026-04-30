export interface Character {
  name: string;
  title: string;
  archetype?: string;
  appearance: string;
  personality: string;
  desire?: string;
  fear?: string;
  background: string;
  abilities: string;
  weaknesses?: string;
  behaviorPatterns?: string;
  beliefs?: string;
  motivation: string;
  vignette?: string;
}

export interface StoryDimension {
  id: string;
  name: string;
}

export interface NarrativeOption {
  label: string;
  text: string;
  dimensionId: string;
}

export interface Choice {
  id: string;
  text: string;
  consequence: string;
}

export interface KeyNode {
  id: string;
  title: string;
  description: string;
  act?: number;
  triggerConditions?: { dimensionId: string; threshold: number }[];
  trigger: string;
  choices: Choice[];
}

export interface Ending {
  id: string;
  title: string;
  summary: string;
  conditions: { nodeId: string; choiceId: string }[];
}

export interface WorldSetting {
  id: string;
  title: string;
  genre: string;
  worldview: string;
  protagonist: Character;
  dimensions?: StoryDimension[];
  styleGuide?: string;
  keyNodes: KeyNode[];
  endings: Ending[];
  createdAt: number;
}

export interface NarrativeMessage {
  role: "narrator" | "player" | "npc" | "system";
  speaker?: string;
  content: string;
  timestamp: number;
}

export interface ChoiceMade {
  nodeId: string;
  choiceId: string;
  choiceText: string;
  timestamp: number;
}

export interface GameState {
  id: string;
  worldId: string;
  currentNodeIndex: number;
  choicesMade: ChoiceMade[];
  narrative: NarrativeMessage[];
  sideCharacters: Character[];
  dimensions?: Record<string, number>;
  pendingChoices?: NarrativeOption[];
  triggeredNodes?: string[];
  endingReached?: string;
  createdAt: number;
  updatedAt: number;
}

export interface GameSave {
  world: WorldSetting;
  state: GameState;
}
