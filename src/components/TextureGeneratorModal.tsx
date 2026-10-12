import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Download,
  X,
  Loader2,
  RefreshCw,
  Wand2,
  FolderPlus,
  Check,
  Maximize2,
  FileCode,
} from 'lucide-react';
import { Project, AddonComponent, GeneratedTexture } from '../types/addon';

interface TextureGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeProject?: Project;
  onSaveTextureToProject: (comp: AddonComponent) => void;
  initialTexture?: GeneratedTexture | null;
}

export const TextureGeneratorModal: React.FC<TextureGeneratorModalProps> = ({
  isOpen,
  onClose,
  activeProject,
  onSaveTextureToProject,
  initialTexture,
}) => {
  // 1. AI 提示詞
  const [prompt, setPrompt] = useState('一個帥氣的未來科技方塊，具有霓虹發光電路、深邃黑曜石金屬倒角、立體等角透視與懸浮粒子光環');

  // 2. AI 修改微調進化
  const [editInstruction, setEditInstruction] = useState('');

  // 狀態管理
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successNotice, setSuccessNotice] = useState('');

  // 當前生成的材質資料
  const [textureName, setTextureName] = useState('cool_future_cube');
  const [currentSvg, setCurrentSvg] = useState<string>('');
  const [currentDataUrl, setCurrentDataUrl] = useState<string>('');
  const [itemDescription, setItemDescription] = useState<string>('');

  // 1024x1024 畫布與顯示
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [zoomMode, setZoomMode] = useState<'fit' | 'actual'>('fit');

  // 分析當前 SVG 所使用的豐富光譜色票
  const extractedColors = React.useMemo(() => {
    if (!currentSvg) return [];
    const matches = currentSvg.match(/#[0-9a-fA-F]{3,8}/g) || [];
    return Array.from(new Set(matches.map((c) => c.toLowerCase())));
  }, [currentSvg]);

  // 把畫顯現出來的 Canvas 渲染方法
  const renderToCanvas = useCallback((sourceUrl: string) => {
    if (!sourceUrl) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.clearRect(0, 0, 1024, 1024);
      ctx.drawImage(img, 0, 0, 1024, 1024);
    };
    img.src = sourceUrl;
  }, []);

  // 初始材質載入
  useEffect(() => {
    if (initialTexture) {
      setTextureName(initialTexture.name || 'custom_item');
      if (initialTexture.dataUrl) {
        setCurrentDataUrl(initialTexture.dataUrl);
        renderToCanvas(initialTexture.dataUrl);
      }
    }
  }, [initialTexture, renderToCanvas]);

  // 開啟時重繪
  useEffect(() => {
    if (isOpen && currentDataUrl) {
      setTimeout(() => renderToCanvas(currentDataUrl), 100);
    }
  }, [isOpen, currentDataUrl, renderToCanvas]);

  // 3. 開始生成 (純 AI 1024x1024 真實生成)
  const handleGenerate1024Texture = async () => {
    if (!prompt.trim()) {
      setErrorMsg('請輸入 AI 提示詞');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    setSuccessNotice('');

    try {
      const res = await fetch('/api/generate-texture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `AI 伺服器回應錯誤 (HTTP ${res.status})`);
      }

      const data = await res.json();
      const tex = data.texture;
      if (!tex || !tex.dataUrl) {
        throw new Error(data.error || '無法取得 AI 生成材質資料');
      }

      setTextureName(tex.name || 'custom_item');
      setCurrentSvg(tex.svg || '');
      setCurrentDataUrl(tex.dataUrl);
      setItemDescription(tex.description || '');
      renderToCanvas(tex.dataUrl);

      setSuccessNotice('✨ 超帥 1024×1024 神級圖標生成成功！');
      setTimeout(() => setSuccessNotice(''), 3500);
    } catch (err: any) {
      let msg = err.message || 'AI 生成失敗，請再試一次';
      try {
        const parsed = JSON.parse(msg);
        if (parsed?.error?.message) msg = parsed.error.message;
      } catch {}
      if (/high demand|503|UNAVAILABLE/i.test(msg)) {
        msg = '⚡ AI 雲端模型目前瞬間負載較高，系統已自動排程重試，請稍候 3 秒後再次點擊「開始生成」！';
      }
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // 4. AI 修改微調進化
  const handleApplyAIEdit = async () => {
    if (!editInstruction.trim()) {
      setErrorMsg('請輸入要微調或進化的指令');
      return;
    }

    setIsEditing(true);
    setErrorMsg('');
    setSuccessNotice('');

    try {
      const res = await fetch('/api/generate-texture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          editInstruction: editInstruction.trim(),
          previousSvg: currentSvg,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `AI 修改伺服器回應錯誤 (HTTP ${res.status})`);
      }

      const data = await res.json();
      const tex = data.texture;
      if (!tex || !tex.dataUrl) {
        throw new Error(data.error || 'AI 修改微調失敗，請再試一次');
      }

      setTextureName(tex.name || textureName);
      setCurrentSvg(tex.svg || '');
      setCurrentDataUrl(tex.dataUrl);
      setItemDescription(tex.description || '');
      renderToCanvas(tex.dataUrl);

      setSuccessNotice('🌟 AI 已根據您的指令完成微調進化！');
      setEditInstruction('');
      setTimeout(() => setSuccessNotice(''), 3500);
    } catch (err: any) {
      let msg = err.message || 'AI 修改微調失敗，請再試一次';
      try {
        const parsed = JSON.parse(msg);
        if (parsed?.error?.message) msg = parsed.error.message;
      } catch {}
      if (/high demand|503|UNAVAILABLE/i.test(msg)) {
        msg = '⚡ AI 雲端模型目前瞬間負載較高，系統已自動排程重試，請稍候 3 秒後再次點擊「套用微調進化」！';
      }
      setErrorMsg(msg);
    } finally {
      setIsEditing(false);
    }
  };

  // 下載 1024x1024 PNG
  const handleDownloadPng = () => {
    if (!currentDataUrl) return;
    const a = document.createElement('a');
    a.href = currentDataUrl;
    a.download = `${textureName || 'item_1024'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // 下載 SVG 原始檔
  const handleDownloadSvg = () => {
    if (!currentSvg) return;
    const blob = new Blob([currentSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${textureName || 'item_1024'}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 儲存至模組材質庫
  const handleSaveToProject = () => {
    if (!currentDataUrl) return;
    const cleanId = (textureName || 'custom_item').toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const comp: AddonComponent = {
      id: `tex-${Date.now()}`,
      type: 'texture',
      name: textureName || 'AI 1024x1024 材質',
      identifier: `${activeProject?.namespace || 'custom'}:${cleanId}`,
      filePath: `RP/textures/items/${cleanId}.png`,
      contentJson: currentDataUrl,
      imageDataUrl: currentDataUrl,
      textureData: {
        width: 1024,
        height: 1024,
        palette: {},
        grid: [],
      },
    };
    onSaveTextureToProject(comp);
    setSuccessNotice(`✅ 已成功將 1024×1024 圖標加入材質庫！路徑: RP/textures/items/${cleanId}.png`);
    setTimeout(() => {
      setSuccessNotice('');
      onClose();
    }, 1200);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-neutral-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#242424] bg-[#181818]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-sky-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-cyan-950/50">
              <Sparkles className="w-5 h-5 text-cyan-200 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  AI 1024×1024 超帥圖標工坊
                </h2>
                <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 shadow-sm">
                  100% PURE AI
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-950/70 text-indigo-300 border border-indigo-800/50">
                  1024×1024 HD
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                輸入提示詞讓頂級 AI 創造神級方塊、武器、裝備或物品，並可一鍵微調進化
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-[#252525] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: 操作控制區 */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            
            {/* 1. AI 提示詞 */}
            <div className="p-4 rounded-xl bg-[#181818] border border-[#282828] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>AI 提示詞</span>
                </label>
                <span className="text-[10px] text-neutral-400">支援方塊、武器、裝備、神物</span>
              </div>

              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="輸入你想生成的物品、方塊、武器或裝備（例如：一個帥氣的方塊、狂怒神鎬、星界神劍、泰坦重盾...）"
                rows={4}
                className="w-full bg-[#101010] border border-[#333] rounded-lg px-3 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500 transition-colors resize-none leading-relaxed"
              />

              {/* 2. 開始生成按鈕 */}
              <button
                onClick={handleGenerate1024Texture}
                disabled={isLoading || isEditing || !prompt.trim()}
                className="mt-2 w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-600 via-sky-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-cyan-950/40 disabled:opacity-50 transition-all cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>AI 正在智慧生成超帥 1024×1024 圖標...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    <span>開始生成</span>
                  </>
                )}
              </button>
            </div>

            {/* 3. AI 修改微調進化 */}
            <div className="p-4 rounded-xl bg-[#181818] border border-[#282828] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                  <span>AI 修改微調進化</span>
                </label>
                <span className="text-[10px] text-neutral-500 font-mono">以此畫為基礎昇華</span>
              </div>

              <textarea
                value={editInstruction}
                onChange={(e) => setEditInstruction(e.target.value)}
                placeholder="輸入修改或進化指令（例如：讓方塊表面浮現熾熱金色裂紋、邊角加裝黑曜石護角、加強光芒粒子...）"
                rows={3}
                disabled={!currentDataUrl}
                className="w-full bg-[#101010] border border-[#333] rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500 transition-colors resize-none leading-relaxed disabled:opacity-50"
              />

              <button
                onClick={handleApplyAIEdit}
                disabled={isEditing || isLoading || !editInstruction.trim() || !currentDataUrl}
                className="mt-1 w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#252525] hover:bg-[#303030] border border-cyan-700/60 text-cyan-300 hover:text-white text-xs font-semibold disabled:opacity-40 transition-all cursor-pointer"
              >
                {isEditing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>AI 正在昇華深化細節與微調...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>套用微調進化</span>
                  </>
                )}
              </button>
            </div>

            {/* 訊息提示 */}
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-950/60 border border-red-700/80 text-red-200 text-xs">
                {errorMsg}
              </div>
            )}
            {successNotice && (
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-700/80 text-emerald-200 text-xs flex items-center gap-1.5">
                <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{successNotice}</span>
              </div>
            )}

          </div>

          {/* Right Column: 把畫顯現出來的那個地方 */}
          <div className="lg:col-span-7 flex flex-col bg-[#161616] border border-[#282828] rounded-2xl p-5 justify-between">
            
            {/* Top Bar */}
            <div className="w-full flex items-center justify-between pb-3 border-b border-[#242424] mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-400 font-medium">標識符:</span>
                <input
                  type="text"
                  value={textureName}
                  onChange={(e) => setTextureName(e.target.value)}
                  placeholder="cool_custom_item"
                  className="bg-[#101010] border border-[#333] rounded px-2.5 py-1 font-mono text-xs text-cyan-300 focus:outline-none focus:border-cyan-500 w-44"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setZoomMode(zoomMode === 'fit' ? 'actual' : 'fit')}
                  className="p-1.5 rounded-lg bg-[#222] hover:bg-[#2c2c2c] text-neutral-300 text-xs flex items-center gap-1 transition-colors cursor-pointer border border-[#333]"
                  title={zoomMode === 'fit' ? '檢視 100% 原始尺寸' : '適應畫面'}
                >
                  <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{zoomMode === 'fit' ? '100% 原始細節' : '適應視窗'}</span>
                </button>
              </div>
            </div>

            {/* 把畫顯現出來的 Canvas 舞台 */}
            <div className="flex-1 flex items-center justify-center min-h-[380px] max-h-[460px] overflow-auto rounded-xl bg-[#0b0b0b] border border-[#2a2a2a] p-2 relative shadow-inner">
              
              {/* 透明格點棋盤背景 */}
              <div
                className="relative rounded-lg shadow-2xl overflow-hidden transition-all duration-150 flex items-center justify-center"
                style={{
                  backgroundImage: `
                    linear-gradient(45deg, #181818 25%, transparent 25%), 
                    linear-gradient(-45deg, #181818 25%, transparent 25%), 
                    linear-gradient(45deg, transparent 75%, #181818 75%), 
                    linear-gradient(-45deg, transparent 75%, #181818 75%)
                  `,
                  backgroundSize: '16px 16px',
                  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                  backgroundColor: '#0f0f0f',
                  width: zoomMode === 'fit' ? '360px' : '1024px',
                  height: zoomMode === 'fit' ? '360px' : '1024px',
                  maxWidth: zoomMode === 'fit' ? '100%' : 'none',
                  maxHeight: zoomMode === 'fit' ? '100%' : 'none',
                }}
              >
                <canvas
                  ref={canvasRef}
                  width={1024}
                  height={1024}
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'block',
                  }}
                />

                {/* 尚未生成時的引導顯示 */}
                {!currentDataUrl && !isLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-black/60 backdrop-blur-xs">
                    <Sparkles className="w-10 h-10 text-cyan-400 mb-2 animate-bounce" />
                    <span className="text-sm font-bold text-white mb-1">
                      畫作顯現舞台
                    </span>
                    <span className="text-xs text-neutral-400 max-w-xs leading-relaxed">
                      請在左側輸入 AI 提示詞並點擊「開始生成」，AI 將直接在此為您顯現超帥神級畫作
                    </span>
                  </div>
                )}

                {/* 生成中動畫 */}
                {(isLoading || isEditing) && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-black/75 backdrop-blur-xs z-10">
                    <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mb-3" />
                    <span className="text-sm font-bold text-white">
                      {isEditing ? 'AI 正在昇華微調細節與光影...' : 'AI 正在全力繪製 1024×1024 超帥圖標...'}
                    </span>
                    <span className="text-xs text-cyan-300/80 font-mono mt-1">
                      深度演算高動態光影・立體幾何・材質高光與粒子
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* 描述資訊 */}
            {itemDescription && (
              <p className="text-xs text-neutral-400 mt-2 px-1 line-clamp-1 italic">
                {itemDescription}
              </p>
            )}

            {/* 全光譜漸層色票分析 */}
            {extractedColors.length > 0 && (
              <div className="mt-2.5 p-2 rounded-xl bg-[#121212] border border-[#262626] flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-none">
                  <span className="text-[10px] text-neutral-400 shrink-0 font-medium">全光譜漸層色相:</span>
                  {extractedColors.slice(0, 16).map((col, idx) => (
                    <span
                      key={idx}
                      className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0 shadow-xs"
                      style={{ backgroundColor: col }}
                      title={col}
                    />
                  ))}
                  {extractedColors.length > 16 && (
                    <span className="text-[10px] text-cyan-400 font-mono shrink-0 font-semibold">
                      +{extractedColors.length - 16}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-mono text-cyan-300 font-semibold px-2 py-0.5 rounded-full bg-cyan-950/70 border border-cyan-800/50 shrink-0">
                  {extractedColors.length} 種漸層色階
                </span>
              </div>
            )}

            {/* 匯出與儲存操作列 */}
            <div className="flex items-center justify-between pt-3 border-t border-[#242424] mt-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadPng}
                  disabled={!currentDataUrl}
                  className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-[#242424] hover:bg-[#303030] text-neutral-200 text-xs font-medium border border-[#383838] disabled:opacity-40 transition-colors cursor-pointer"
                  title="下載高解析度 1024×1024 PNG"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-400" />
                  <span>下載 PNG</span>
                </button>
                <button
                  onClick={handleDownloadSvg}
                  disabled={!currentSvg}
                  className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-[#242424] hover:bg-[#303030] text-neutral-200 text-xs font-medium border border-[#383838] disabled:opacity-40 transition-colors cursor-pointer"
                  title="下載向量 SVG 檔"
                >
                  <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                  <span>下載 SVG</span>
                </button>
              </div>

              <button
                onClick={handleSaveToProject}
                disabled={!currentDataUrl}
                className="flex items-center gap-1.5 py-2 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/50 disabled:opacity-40 transition-all cursor-pointer"
              >
                <FolderPlus className="w-4 h-4" />
                <span>儲存至材質庫</span>
              </button>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
