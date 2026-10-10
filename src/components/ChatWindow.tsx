import React, { useState, useRef, useEffect } from 'react';
import { 
  PanelLeft, 
  ChevronDown, 
  ChevronRight,
  Download, 
  Upload, 
  Paperclip, 
  ArrowUp, 
  Copy, 
  Check, 
  Plus, 
  Sparkles, 
  X,
  Layers,
  Brain,
  Cloud,
  Activity,
  Lightbulb,
  FileCode,
  CheckCircle2,
  Paintbrush,
  FileText,
  Package,
  FolderPlus,
  LogIn,
  UserPlus,
  Image as ImageIcon
} from 'lucide-react';
import { ChatSession, Project, AddonComponent, ChatMessage, GeneratedTexture } from '../types/addon';
import { AppUser } from '../services/cloudStorage';

interface ChatWindowProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  activeProject?: Project | null;
  currentSession?: ChatSession | null;
  onSendMessage: (text: string, imageBase64?: string) => void;
  isStreaming: boolean;
  onOpenThoughtInspector: () => void;
  onOpenImportModal: () => void;
  onExportAddon: () => void;
  onOpenProjectModal: () => void;
  onAddComponentToProject: (comp: AddonComponent) => void;
  onOpenTextureModal?: (initialTexture?: GeneratedTexture | null) => void;
  isCloudSynced: boolean;
  currentUser?: AppUser | null;
  onOpenAuth?: (mode?: 'login' | 'register') => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  sidebarOpen,
  onToggleSidebar,
  activeProject,
  currentSession,
  onSendMessage,
  isStreaming,
  onOpenThoughtInspector,
  onOpenImportModal,
  onExportAddon,
  onOpenProjectModal,
  onAddComponentToProject,
  onOpenTextureModal,
  isCloudSynced,
  currentUser,
  onOpenAuth,
}) => {
  const [inputText, setInputText] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [addedCompId, setAddedCompId] = useState<string | null>(null);

  // Expanded thought accordion state for messages (msgId -> boolean)
  const [expandedThoughts, setExpandedThoughts] = useState<Record<string, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const safeMessages = currentSession?.messages || [];

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [safeMessages, isStreaming]);

  // Handle textarea resize
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputText]);

  const toggleThought = (msgId: string) => {
    setExpandedThoughts((prev) => ({
      ...prev,
      [msgId]: prev[msgId] === undefined ? false : !prev[msgId],
    }));
  };

  const handleSend = () => {
    if ((!inputText.trim() && !attachedImage) || isStreaming) return;
    onSendMessage(inputText.trim(), attachedImage || undefined);
    setInputText('');
    setAttachedImage(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setAttachedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const addCodeToProject = (code: string, language: string, id: string) => {
    let type: AddonComponent['type'] = 'other';
    let identifier = `custom:component_${Date.now().toString().slice(-4)}`;
    let name = '自訂模組組件';

    try {
      const parsed = JSON.parse(code);
      if (parsed['minecraft:item']) {
        type = 'item';
        identifier = parsed['minecraft:item'].description?.identifier || identifier;
        name = parsed['minecraft:item'].components?.['minecraft:display_name']?.value || identifier;
      } else if (parsed['minecraft:entity']) {
        type = 'entity';
        identifier = parsed['minecraft:entity'].description?.identifier || identifier;
        name = identifier;
      } else if (parsed['minecraft:block']) {
        type = 'block';
        identifier = parsed['minecraft:block'].description?.identifier || identifier;
        name = identifier;
      } else if (parsed['minecraft:recipe_shaped'] || parsed['minecraft:recipe_shapeless']) {
        type = 'recipe';
        identifier = parsed['minecraft:recipe_shaped']?.description?.identifier || 
                     parsed['minecraft:recipe_shapeless']?.description?.identifier || identifier;
        name = identifier;
      }
    } catch {}

    const newComp: AddonComponent = {
      id: `comp-${Date.now()}`,
      type,
      name: typeof name === 'string' ? name.replace(/§[0-9a-fk-or]/g, '') : identifier,
      identifier,
      filePath: `${type === 'other' ? '' : type + 's/'}${identifier.split(':')[1] || 'addon'}.json`,
      contentJson: code,
    };

    onAddComponentToProject(newComp);
    setAddedCompId(id);
    setTimeout(() => setAddedCompId(null), 2500);
  };

  const handleAddTextureToProject = (tex: GeneratedTexture) => {
    const comp: AddonComponent = {
      id: `tex-${Date.now()}`,
      type: 'texture',
      name: tex.name,
      identifier: `${activeProject?.namespace || 'custom'}:${tex.name}`,
      filePath: tex.targetPath || `RP/textures/items/${tex.name}.png`,
      contentJson: tex.dataUrl,
      imageDataUrl: tex.dataUrl,
      textureData: tex.palette && tex.grid ? {
        width: tex.width || 16,
        height: tex.height || 16,
        palette: tex.palette,
        grid: tex.grid,
      } : undefined,
    };
    onAddComponentToProject(comp);
    setAddedCompId(tex.id);
    setTimeout(() => setAddedCompId(null), 2500);
  };

  // Render assistant message markdown & code blocks
  const renderMessageContent = (content: string, msgId: string) => {
    if (!content) {
      return (
        <div className="flex items-center gap-2 text-xs text-neutral-400 py-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>正在撰寫回覆內容與代碼...</span>
        </div>
      );
    }

    const codeRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let blockIdx = 0;

    while ((match = codeRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(
          <div key={`txt-${lastIndex}`} className="whitespace-pre-wrap leading-relaxed text-neutral-200">
            {content.substring(lastIndex, match.index)}
          </div>
        );
      }

      const lang = match[1] || 'json';
      const code = match[2];
      const codeId = `${msgId}-${blockIdx}`;
      const isCopied = copiedCodeId === codeId;
      const isAdded = addedCompId === codeId;

      parts.push(
        <div key={`code-${match.index}`} className="my-3 rounded-xl bg-[#0d0d0d] border border-[#262626] overflow-hidden">
          <div className="flex items-center justify-between px-3.5 py-2 bg-[#171717] border-b border-[#262626] text-xs">
            <span className="font-mono text-neutral-400 font-medium lowercase">
              {lang}
            </span>
            <div className="flex items-center gap-2">
              {onOpenTextureModal && (code.includes('"minecraft:item"') || code.includes('"minecraft:icon"') || code.includes('textures')) && (
                <button
                  onClick={() => onOpenTextureModal()}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#262626] hover:bg-[#333] text-cyan-400 text-xs font-medium transition-colors border border-cyan-900/40"
                  title="為此物品製作 1024×1024 超高畫質神級圖標"
                >
                  <Paintbrush className="w-3.5 h-3.5" />
                  <span>製作 1024×1024 圖標</span>
                </button>
              )}
              <button
                onClick={() => addCodeToProject(code, lang, codeId)}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#262626] hover:bg-[#333] text-emerald-400 text-xs font-medium transition-colors"
                title="將此 JSON 加入當前模組專案"
              >
                {isAdded ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{isAdded ? '已加入專案!' : '加入專案 Add-on'}</span>
              </button>
              <button
                onClick={() => copyCode(code, codeId)}
                className="flex items-center gap-1 px-2 py-1 rounded text-neutral-400 hover:text-white transition-colors"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{isCopied ? '已複製' : '複製代碼'}</span>
              </button>
            </div>
          </div>
          <pre className="p-4 text-xs font-mono text-neutral-200 overflow-x-auto leading-relaxed">
            <code>{code}</code>
          </pre>
        </div>
      );

      lastIndex = match.index + match[0].length;
      blockIdx++;
    }

    if (lastIndex < content.length) {
      parts.push(
        <div key={`txt-${lastIndex}`} className="whitespace-pre-wrap leading-relaxed text-neutral-200">
          {content.substring(lastIndex)}
        </div>
      );
    }

    return parts;
  };

  const isEmpty = !currentSession || currentSession.messages.length === 0;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#212121] text-[#ececec] overflow-hidden relative">
      {/* Top ChatGPT Navigation Bar */}
      <header className="h-14 px-4 border-b border-[#2d2d2d] flex items-center justify-between shrink-0 bg-[#212121] z-10">
        <div className="flex items-center gap-2">
          {!sidebarOpen && (
            <button
              onClick={onToggleSidebar}
              className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-[#2f2f2f] transition-colors"
              title="展開側邊欄"
            >
              <PanelLeft className="w-5 h-5" />
            </button>
          )}

          {/* Model indicator */}
          <div 
            onClick={onOpenThoughtInspector}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-[#2f2f2f] cursor-pointer text-sm font-semibold text-neutral-200 transition-colors group"
            title="點擊查看 CraftGPT 大腦監控"
          >
            <div className={`w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center text-white text-[10px] ${
              isStreaming ? 'ring-2 ring-emerald-400 animate-pulse' : ''
            }`}>
              <Brain className="w-3 h-3" />
            </div>
            <span>CraftGPT 4o</span>
            <span className="text-xs text-neutral-400 font-normal">
              · {activeProject?.name || (currentUser ? '未選取模組' : '尚未登入')}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-neutral-400 group-hover:text-emerald-400 transition-colors" />
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* Cloud Sync Status */}
          <div className="flex items-center gap-1 text-[11px] text-neutral-400 px-2 py-1 rounded bg-[#282828] border border-[#353535]">
            <Cloud className={`w-3.5 h-3.5 ${isCloudSynced ? 'text-emerald-400' : 'text-neutral-500'}`} />
            <span className="hidden sm:inline">{isCloudSynced ? '已登入同步' : '尚未登入'}</span>
          </div>

          {/* Import Add-on */}
          <button
            onClick={onOpenImportModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2f2f2f] hover:bg-[#383838] border border-[#3e3e3e] text-xs font-medium text-neutral-200 transition-colors"
            title="匯入現有 .mcaddon 或 .json"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-400" />
            <span>匯入 Add-on</span>
          </button>

          {/* AI Texture Studio */}
          <button
            onClick={() => onOpenTextureModal?.()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#272727] hover:bg-[#333] border border-cyan-800/50 text-xs font-medium text-cyan-300 hover:text-cyan-200 transition-colors shadow-sm"
            title="開啟 1024×1024 神級 AI 圖標工坊"
          >
            <Paintbrush className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">1024×1024 神級圖標</span>
          </button>

          {/* Export Add-on */}
          <button
            onClick={onExportAddon}
            disabled={!activeProject}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium text-white transition-colors shadow-sm"
            title="打包下載當前專案為 .mcaddon"
          >
            <Download className="w-3.5 h-3.5" />
            <span>匯出 .mcaddon</span>
          </button>

          {/* Project Details */}
          <button
            onClick={onOpenProjectModal}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#2f2f2f] hover:bg-[#383838] text-xs font-medium text-neutral-300 transition-colors"
            title="管理專案"
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="font-mono text-[11px] text-emerald-400">{activeProject?.components?.length || 0}</span>
          </button>
        </div>
      </header>

      {/* Main Messages Container */}
      <div className="flex-1 overflow-y-auto px-4">
        {!currentUser ? (
          /* User Not Logged In Prompt */
          <div className="h-full flex flex-col items-center justify-center max-w-md mx-auto text-center px-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-4 shadow-xl">
              <Cloud className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-bold text-white mb-2">
              請登入以存取您的 Minecraft 模組
            </h1>
            <p className="text-xs text-neutral-400 max-w-sm mb-6 leading-relaxed">
              每個帳號的模組專案與對話完全獨立隔離。登出後資料安全保存，登入後立即完整載入。
            </p>

            <div className="w-full space-y-2.5">
              <button
                onClick={() => onOpenAuth?.('login')}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2 shadow"
              >
                <LogIn className="w-4 h-4" />
                <span>登入帳號</span>
              </button>

              <button
                onClick={() => onOpenAuth?.('register')}
                className="w-full py-2.5 px-4 rounded-xl bg-[#2a2a2a] hover:bg-[#333] border border-[#3e3e3e] text-neutral-200 text-xs font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <UserPlus className="w-4 h-4 text-emerald-400" />
                <span>建立帳號</span>
              </button>

              <button
                onClick={() => onOpenAuth?.('login')}
                className="w-full py-2.5 px-4 rounded-xl bg-[#222222] hover:bg-[#2a2a2a] border border-[#353535] text-neutral-300 text-xs font-medium transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>使用 Google 登入</span>
              </button>
            </div>
          </div>
        ) : !activeProject ? (
          /* User Logged in but has 0 projects */
          <div className="h-full flex flex-col items-center justify-center max-w-md mx-auto text-center px-4">
            <div className="w-14 h-14 rounded-2xl bg-[#2a2a2a] border border-[#3e3e3e] flex items-center justify-center text-emerald-400 mb-4 shadow-xl">
              <FolderPlus className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-bold text-white mb-2">
              歡迎，{currentUser.displayName || currentUser.email}！
            </h1>
            <p className="text-xs text-neutral-400 max-w-sm mb-6 leading-relaxed">
              此帳號目前尚無模組專案。點擊下方按鈕建立您的第一個模組資料夾 (BP/RP)。
            </p>
            <button
              onClick={onOpenProjectModal}
              className="py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors flex items-center gap-2 shadow"
            >
              <Plus className="w-4 h-4" />
              <span>建立新模組專案</span>
            </button>
          </div>
        ) : isEmpty ? (
          /* Exact ChatGPT Minimalist Empty State */
          <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto text-center px-4">
            <button
              onClick={onOpenThoughtInspector}
              className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center text-white mb-4 shadow-xl hover:scale-105 transition-all group relative cursor-pointer"
              title="點擊透視 CraftGPT 目前在想什麼／做什麼"
            >
              <Sparkles className="w-7 h-7" />
              <div className="absolute -bottom-1 -right-1 bg-[#1a1a1a] rounded-full p-1 border border-neutral-700">
                <Brain className="w-3.5 h-3.5 text-emerald-400" />
              </div>
            </button>
            <h1 className="text-2xl font-bold text-white mb-2">
              今天想製作什麼 Minecraft Add-on？
            </h1>
            <p className="text-sm text-neutral-400 max-w-md mb-4">
              專門生成基岩版（Bedrock 1.21+）物品、實體生物、自訂方塊與合成配方，或解答任何問題。
            </p>
          </div>
        ) : (
          /* Message Flow */
          <div className="max-w-3xl mx-auto py-8 space-y-6">
            {safeMessages.map((msg) => {
              const isUser = msg.role === 'user';
              const thoughts = msg.thoughts || [];
              const hasThoughts = thoughts.length > 0 || msg.isThinking;
              const isExpanded = expandedThoughts[msg.id] !== undefined 
                ? expandedThoughts[msg.id] 
                : false; // default collapsed, clicks to expand downwards!

              const elapsedDisplay = msg.isThinking
                ? `思考與生成中 (${msg.elapsedSeconds ? msg.elapsedSeconds.toFixed(1) + 's' : '進行中'})`
                : (msg.elapsedSeconds ? `已思考 ${msg.elapsedSeconds.toFixed(1)} 秒 · 思考歷程` : '思考與生成歷程');

              return (
                <div key={msg.id} className="flex gap-4">
                  {/* Avatar */}
                  <div className="shrink-0 pt-0.5">
                    {isUser ? (
                      <div className="w-7 h-7 rounded-full bg-neutral-700 flex items-center justify-center text-xs font-medium text-white">
                        U
                      </div>
                    ) : (
                      <button
                        onClick={onOpenThoughtInspector}
                        className={`w-7 h-7 rounded-full bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center text-xs font-medium text-white shadow-sm cursor-pointer transition-transform hover:scale-110 ${
                          msg.isThinking ? 'ring-2 ring-emerald-400 animate-pulse' : ''
                        }`}
                        title="點擊查看 CraftGPT 思維歷程"
                      >
                        <Brain className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Message Bubble */}
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="text-xs font-semibold text-neutral-400 flex items-center gap-2">
                      <span>{isUser ? '你' : 'CraftGPT'}</span>
                    </div>

                    {msg.attachedImage && (
                      <div className="mb-2 max-w-sm rounded-lg overflow-hidden border border-[#333]">
                        <img src={msg.attachedImage} alt="附圖" className="w-full h-auto object-cover max-h-60" />
                      </div>
                    )}

                    {/* Collapsible Thought Box (Identical to User's Screenshot left panel) */}
                    {!isUser && hasThoughts && (
                      <div className="rounded-xl border border-[#2f2f2f] bg-[#1a1a1a]/90 overflow-hidden text-xs">
                        {/* Accordion Header */}
                        <button
                          onClick={() => toggleThought(msg.id)}
                          className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-[#242424] text-neutral-300 transition-colors select-none text-left"
                        >
                          <div className="flex items-center gap-2">
                            <Lightbulb className={`w-3.5 h-3.5 ${msg.isThinking ? 'text-amber-400 animate-pulse' : 'text-neutral-400'}`} />
                            <span className="font-medium text-neutral-200">
                              {elapsedDisplay}
                            </span>
                            {msg.currentAction && msg.isThinking && (
                              <span className="text-[11px] text-emerald-400 font-mono truncate max-w-xs">
                                · {msg.currentAction}
                              </span>
                            )}
                          </div>
                          <div className="text-neutral-400 p-0.5">
                            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          </div>
                        </button>

                        {/* Accordion Body */}
                        {isExpanded && (
                          <div className="px-3.5 py-3 border-t border-[#262626] bg-[#141414] space-y-2 font-mono text-[11px]">
                            {thoughts.map((t, idx) => (
                              <div key={idx} className="flex items-start gap-2 text-neutral-300">
                                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                                <div>
                                  {t.step && (
                                    <span className="text-emerald-400 font-bold mr-1.5">
                                      [{t.step}]
                                    </span>
                                  )}
                                  <span className="text-neutral-300 leading-relaxed font-sans text-xs">
                                    {t.detail}
                                  </span>
                                </div>
                              </div>
                            ))}

                            {msg.isThinking && (
                              <div className="flex items-center gap-2 text-emerald-400 text-xs font-sans pt-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                                <span>{msg.currentAction || '正在進行神經網路推理與代碼建置...'}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Message Body Content */}
                    <div className="text-sm text-neutral-200">
                      {renderMessageContent(msg.content, msg.id)}
                    </div>

                    {/* Generated Texture Cards */}
                    {msg.generatedImages && msg.generatedImages.length > 0 && (
                      <div className="mt-4 flex flex-col gap-3">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-400">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>AI 生成像素材質圖片 (HD 32x32 PNG 原版強化)</span>
                        </div>
                        {msg.generatedImages.map((tex) => {
                          const isAdded = addedCompId === tex.id;
                          const width = tex.width || 32;
                          const height = tex.height || 32;
                          return (
                            <div 
                              key={tex.id}
                              className="rounded-xl bg-[#141414] border border-[#2d2d2d] hover:border-cyan-700/60 p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg transition-all"
                            >
                              <div className="flex items-center gap-3.5">
                                {/* Pixel preview with checkerboard */}
                                <div 
                                  className="w-16 h-16 rounded-lg bg-[#0e0e0e] border border-[#333] flex items-center justify-center p-1 relative shadow-inner overflow-hidden shrink-0"
                                  style={{
                                    backgroundImage: `
                                      linear-gradient(45deg, #181818 25%, transparent 25%),
                                      linear-gradient(-45deg, #181818 25%, transparent 25%),
                                      linear-gradient(45deg, transparent 75%, #181818 75%),
                                      linear-gradient(-45deg, transparent 75%, #181818 75%)
                                    `,
                                    backgroundSize: '10px 10px',
                                    backgroundColor: '#121212',
                                  }}
                                >
                                  <img 
                                    src={tex.dataUrl} 
                                    alt={tex.name} 
                                    className="w-14 h-14 object-contain"
                                    style={{ imageRendering: (tex.width && tex.width >= 512) ? 'auto' : 'pixelated' }}
                                  />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-white">{tex.name}</span>
                                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950/70 text-cyan-300 border border-cyan-800/40">
                                      {width}x{height} HD PNG
                                    </span>
                                  </div>
                                  <div className="text-xs font-mono text-neutral-400 mt-0.5">
                                    路徑: {tex.targetPath}
                                  </div>
                                  <div className="text-[11px] text-neutral-500 mt-0.5">
                                    {tex.description || 'Minecraft 1024×1024 超高畫質神級圖標'}
                                  </div>
                                </div>
                              </div>

                              {/* Action buttons */}
                              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                                <button
                                  onClick={() => handleAddTextureToProject(tex)}
                                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shadow ${
                                    isAdded 
                                      ? 'bg-emerald-700 text-white' 
                                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                  }`}
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>{isAdded ? '已加入專案!' : '加入模組材質'}</span>
                                </button>
                                <button
                                  onClick={() => onOpenTextureModal?.(tex)}
                                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#262626] hover:bg-[#333] text-cyan-300 text-xs font-medium transition-colors border border-[#3a3a3a]"
                                >
                                  <Paintbrush className="w-3.5 h-3.5" />
                                  <span>畫布微調</span>
                                </button>
                                <a
                                  href={tex.dataUrl}
                                  download={`${tex.name}.png`}
                                  className="p-1.5 rounded-lg bg-[#222] hover:bg-[#333] text-neutral-300 hover:text-white transition-colors"
                                  title="下載 PNG"
                                >
                                  <Download className="w-4 h-4" />
                                </a>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Auto Applied Files Summary (AI 自動寫入模組資料夾) */}
                    {msg.autoAppliedSummary && (
                      <div className="mt-4 rounded-xl bg-[#111915] border border-emerald-500/40 p-4 shadow-xl">
                        <div className="flex items-center justify-between pb-2.5 border-b border-emerald-900/40">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                            <h4 className="text-xs font-bold text-emerald-300">
                              ⚡ AI 已自動更新模組資料夾結構 (無需手動操作)
                            </h4>
                          </div>
                          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/40">
                            共 {msg.autoAppliedSummary.files.length} 個檔案已寫入
                          </span>
                        </div>

                        <div className="mt-2 text-xs text-neutral-300 leading-relaxed">
                          {msg.autoAppliedSummary.summary}
                        </div>

                        {/* File List Grid */}
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-44 overflow-y-auto pr-1">
                          {msg.autoAppliedSummary.files.map((file, idx) => (
                            <div 
                              key={idx}
                              className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#16221c] border border-emerald-900/30 text-xs"
                            >
                              <div className="flex items-center gap-2 truncate">
                                {file.path.endsWith('.png') ? (
                                  <ImageIcon className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                ) : file.path.endsWith('.md') ? (
                                  <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                ) : (
                                  <FileCode className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                )}
                                <span className="font-mono text-neutral-200 text-[11px] truncate">{file.path}</span>
                              </div>
                              <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded shrink-0">
                                {file.action === 'created' ? '+ 已新增' : '✓ 已更新'}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="mt-2.5 text-[11px] text-neutral-400 flex items-center justify-between">
                          <span>可在左側「模組檔案目錄樹」隨時展開查看 BP、RP 與 README 結構。</span>
                          <span className="text-emerald-400 font-mono">自動同步完成</span>
                        </div>
                      </div>
                    )}

                    {/* Chat Export Download Badge (對話內直接呈現下載連結與技能) */}
                    {msg.exportBadge && (
                      <div className="mt-4 rounded-xl bg-gradient-to-r from-[#14231b] via-[#101e17] to-[#121c16] border-2 border-emerald-500/70 p-4 shadow-2xl">
                        <div className="flex items-start gap-3.5">
                          <div className="w-12 h-12 rounded-xl bg-emerald-600/30 border border-emerald-500/50 flex items-center justify-center text-emerald-300 shrink-0 shadow-inner">
                            <Package className="w-6 h-6 animate-bounce" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-sm text-white">📦 CraftGPT 模組自動打包完成！</h4>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold">
                                專屬匯出技能
                              </span>
                            </div>
                            <div className="text-xs text-neutral-300 mt-1 font-mono truncate">
                              檔案名稱: <span className="text-emerald-400 font-semibold">{msg.exportBadge.filename}</span>
                            </div>
                            <div className="text-[11px] text-neutral-400 mt-0.5">
                              包含完整 BP 行為包、RP 資源包、HD 32x32 像素材質及安裝說明 (README.md)
                            </div>
                          </div>
                        </div>

                        {/* Interactive Direct Download Link */}
                        <div className="mt-4 pt-3 border-t border-emerald-900/50 flex flex-wrap items-center gap-2.5">
                          <button
                            onClick={onExportAddon}
                            className="flex-1 min-w-[220px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition-all shadow-lg hover:shadow-emerald-500/30 active:scale-95"
                          >
                            <Download className="w-4 h-4 stroke-[2.5]" />
                            <span>📥 點擊立即下載 {msg.exportBadge.filename} (雙擊自動匯入 Minecraft)</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Floating ChatGPT Input Bar */}
      <div className="p-4 bg-gradient-to-t from-[#212121] via-[#212121] to-transparent shrink-0">
        <div className="max-w-3xl mx-auto">
          {/* Attached image preview */}
          {attachedImage && (
            <div className="mb-2 inline-flex items-center gap-2 p-1.5 rounded-lg bg-[#2f2f2f] border border-[#3d3d3d]">
              <img src={attachedImage} alt="附圖預覽" className="w-8 h-8 rounded object-cover" />
              <span className="text-xs text-neutral-300">已附帶圖片</span>
              <button onClick={() => setAttachedImage(null)} className="p-1 text-neutral-400 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Pill Container */}
          <div className="relative rounded-2xl bg-[#2f2f2f] border border-[#383838] focus-within:border-[#4d4d4d] px-4 py-3 shadow-lg flex items-end gap-2">
            {/* Attachment Button */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.mcaddon,.mcpack,.json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.name.match(/\.(mcaddon|mcpack|json)$/i)) {
                  onOpenImportModal();
                } else {
                  handleImageSelect(e);
                }
              }}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-[#3a3a3a] transition-colors shrink-0 mb-0.5"
              title="附加圖片或模組檔案"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* AI Texture Studio shortcut */}
            {onOpenTextureModal && (
              <button
                onClick={() => onOpenTextureModal()}
                className="p-1.5 rounded-full text-neutral-400 hover:text-cyan-400 hover:bg-[#3a3a3a] transition-colors shrink-0 mb-0.5"
                title="開啟 1024×1024 神級 AI 圖標工坊"
              >
                <Paintbrush className="w-4 h-4" />
              </button>
            )}

            {/* Input textarea */}
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isStreaming || !currentUser}
              placeholder={currentUser ? "詢問任何問題，或輸入你想客製化的 Minecraft Add-on 功能..." : "請先登入帳號以開始製作模組..."}
              rows={1}
              className="flex-1 bg-transparent border-0 text-sm text-white placeholder-neutral-400 focus:outline-none resize-none max-h-48 py-1 leading-relaxed disabled:opacity-50"
            />

            {/* Send Button */}
            <button
              onClick={handleSend}
              disabled={(!inputText.trim() && !attachedImage) || isStreaming || !currentUser}
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all ${
                (!inputText.trim() && !attachedImage) || isStreaming || !currentUser
                  ? 'bg-[#3d3d3d] text-neutral-500 cursor-not-allowed'
                  : 'bg-white text-black hover:bg-neutral-200 cursor-pointer'
              }`}
            >
              {isStreaming ? (
                <div className="w-3.5 h-3.5 border-2 border-neutral-500 border-t-white rounded-full animate-spin" />
              ) : (
                <ArrowUp className="w-4 h-4" />
              )}
            </button>
          </div>

          <div className="text-[11px] text-center text-neutral-400 mt-2 flex items-center justify-center gap-2">
            <span>CraftGPT 具備無限額度 · 點擊訊息上方思考盒即可展開思維歷程</span>
          </div>
        </div>
      </div>
    </div>
  );
};
