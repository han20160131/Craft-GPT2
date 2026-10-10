export interface ThoughtLogEntry {
  id: string;
  timestamp: number;
  type: 'thought' | 'action' | 'info';
  step?: string;
  detail: string;
}

export interface GeneratedTexture {
  id: string;
  name: string;
  targetPath: string; // e.g. "RP/textures/items/diamond_sword.png"
  dataUrl: string;
  description?: string;
  palette?: Record<string, string>;
  grid?: string[];
  width?: number;
  height?: number;
}

export interface ExportDownloadBadge {
  id: string;
  filename: string;
  projectName: string;
  fileCount: number;
  timestamp: number;
  componentsSummary: {
    bpCount: number;
    rpCount: number;
    textureCount: number;
    hasReadme: boolean;
  };
}

export interface AutoAppliedFileItem {
  path: string;
  name: string;
  type: string;
  action: 'created' | 'updated';
}

export interface AutoAppliedFilesSummary {
  summary: string;
  files: AutoAppliedFileItem[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  attachedImage?: string;
  generatedImages?: GeneratedTexture[];
  exportBadge?: ExportDownloadBadge;
  autoAppliedSummary?: AutoAppliedFilesSummary;
  thoughts?: ThoughtLogEntry[];
  elapsedSeconds?: number;
  isThinking?: boolean;
  currentAction?: string;
  codeBlocks?: {
    language: string;
    code: string;
    filename?: string;
  }[];
}

export interface ChatSession {
  id: string;
  projectId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

export interface AddonComponent {
  id: string;
  type: 'item' | 'entity' | 'block' | 'recipe' | 'function' | 'texture' | 'manifest' | 'doc' | 'lang' | 'other';
  name: string;
  identifier: string; // e.g. "custom:ruby_sword"
  filePath: string;   // e.g. "BP/items/diamond_sword.json" or "RP/textures/items/diamond_sword.png" or "README.md"
  contentJson: string; // stringified JSON, markdown, or base64 representation
  imageDataUrl?: string; // base64 PNG data URL for textures
  textureData?: {
    width: number;
    height: number;
    palette: Record<string, string>;
    grid: string[];
  };
}

export interface Project {
  id: string;
  name: string;
  description: string;
  namespace: string;
  version: [number, number, number];
  createdAt: number;
  components: AddonComponent[];
}
