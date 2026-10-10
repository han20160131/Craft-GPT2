import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Download,
  X,
  Paintbrush,
  Eraser,
  Pipette,
  RotateCcw,
  Check,
  FolderPlus,
  Loader2,
  Sliders,
  Maximize2,
  RefreshCw,
  Wand2,
  Palette,
  Flame,
  Moon,
  Sun,
  Shield,
  Gem
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
  // 1. Primary AI prompt input
  const [prompt, setPrompt] = useState('熾炎泰坦重裝神聖守護盾牌，金屬浮雕，龍鱗裝甲，燃燒熔岩符文');
  // 2. AI Modification & Evolution input (修改的地方)
  const [editInstruction, setEditInstruction] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successNotice, setSuccessNotice] = useState('');

  // Current Generated Texture Data
  const [textureName, setTextureName] = useState('titan_guardian_shield');
  const [currentSvg, setCurrentSvg] = useState<string>('');
  const [currentDataUrl, setCurrentDataUrl] = useState<string>('');

  // 1024x1024 Canvas References & State
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [zoomMode, setZoomMode] = useState<'fit' | 'actual'>('fit');

  // Interactive Tools on 1024x1024 Canvas
  const [currentTool, setCurrentTool] = useState<'brush' | 'eraser' | 'picker'>('brush');
  const [customAuthorColor, setCustomAuthorColor] = useState('#ffd000');
  const [brushSize, setBrushSize] = useState<number>(14);
  const [brushOpacity, setBrushOpacity] = useState<number>(0.9);

  // Author Color & Gradient Tuning Studio (2048+ Color Spectrum)
  // 由作者自己調，AI 自動分析並擴展 2048+ 色譜
  const [hueRotate, setHueRotate] = useState<number>(0);         // 0° - 360° 全色域色相環
  const [saturation, setSaturation] = useState<number>(120);     // 50% - 250% 色彩豐富度/漸層深度
  const [colorTemperature, setColorTemperature] = useState<number>(0); // -50 (冷) ~ +50 (暖)
  const [brightness, setBrightness] = useState<number>(100);     // 50% - 160% 亮度
  const [contrast, setContrast] = useState<number>(110);         // 60% - 180% 對比度/立體感
  const [glowIntensity, setGlowIntensity] = useState<number>(0); // 0 - 25px 神聖光環輝光

  // Helper: Draw image data onto 1024x1024 canvas
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

  // Initialize or update from initialTexture
  useEffect(() => {
    if (initialTexture) {
      setTextureName(initialTexture.name || 'custom_texture');
      if (initialTexture.dataUrl) {
        setCurrentDataUrl(initialTexture.dataUrl);
        renderToCanvas(initialTexture.dataUrl);
      }
    }
  }, [initialTexture, renderToCanvas]);

  // Redraw when modal opens if dataUrl is available
  useEffect(() => {
    if (isOpen && currentDataUrl) {
      setTimeout(() => renderToCanvas(currentDataUrl), 100);
    }
  }, [isOpen, currentDataUrl, renderToCanvas]);

  // 1. Primary AI Generation Handler (1024x1024 Pure AI, 2048+ Colors, Zero Preset Templates)
  const handleGenerate1024Texture = async () => {
    if (!prompt.trim()) {
      setErrorMsg('請輸入 AI 材質提示詞');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    setSuccessNotice('');

    try {
      const res = await fetch('/api/generate-texture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      if (!res.ok) {
        throw new Error(`AI 生成伺服器回應錯誤 (HTTP ${res.status})`);
      }

      const data = await res.json();
      const tex = data.texture;
      if (!tex || !tex.dataUrl) {
        throw new Error(data.error || '無法取得 1024x1024 材質資料');
      }

      setTextureName(tex.name || 'custom_item');
      setCurrentSvg(tex.svg || '');
      setCurrentDataUrl(tex.dataUrl);
      renderToCanvas(tex.dataUrl);

      // Reset tuning sliders
      setHueRotate(0);
      setSaturation(120);
      setColorTemperature(0);
      setBrightness(100);
      setContrast(110);
      setGlowIntensity(0);

      setSuccessNotice('✨ 1024×1024 超高畫質神級圖標已生成完畢！（具備 2048+ 全色階漸層深度）');
      setTimeout(() => setSuccessNotice(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'AI 生成 1024x1024 材質失敗，請再試一次');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. AI Modification & Evolution Handler (修改的地方)
  const handleApplyAIEdit = async () => {
    if (!editInstruction.trim()) {
      setErrorMsg('請輸入要修改或增添的 AI 指令');
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
        throw new Error(`AI 修改伺服器回應錯誤 (HTTP ${res.status})`);
      }

      const data = await res.json();
      const tex = data.texture;
      if (!tex || !tex.dataUrl) {
        throw new Error(data.error || 'AI 修改失敗，請再試一次');
      }

      setTextureName(tex.name || textureName);
      setCurrentSvg(tex.svg || '');
      setCurrentDataUrl(tex.dataUrl);
      renderToCanvas(tex.dataUrl);

      setSuccessNotice('🌟 AI 已根據您的修改指令完成新版本昇華！');
      setEditInstruction('');
      setTimeout(() => setSuccessNotice(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'AI 修改失敗，請再試一次');
    } finally {
      setIsEditing(false);
    }
  };

  // Canvas Drawing Actions (Scales mouse coordinates to 1024x1024)
  const handleCanvasPointerEvent = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = 1024 / rect.width;
    const scaleY = 1024 / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (currentTool === 'picker') {
      const pixel = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
      if (pixel[3] > 10) {
        const hex = `#${((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1)}`;
        setCustomAuthorColor(hex);
        setCurrentTool('brush');
      }
      return;
    }

    ctx.save();
    if (currentTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = brushOpacity;
      ctx.fillStyle = customAuthorColor;
      ctx.shadowColor = customAuthorColor;
      ctx.shadowBlur = glowIntensity > 0 ? glowIntensity * 1.5 : 0;
      ctx.beginPath();
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  // One-Touch Color Palette Presets (由作者自選色調風格)
  const applyTonePreset = (type: 'magma' | 'celestial' | 'gold' | 'emerald' | 'obsidian') => {
    if (type === 'magma') {
      setHueRotate(0);
      setSaturation(140);
      setColorTemperature(25);
      setContrast(120);
      setCustomAuthorColor('#ff4800');
    } else if (type === 'celestial') {
      setHueRotate(210);
      setSaturation(150);
      setColorTemperature(-30);
      setContrast(115);
      setCustomAuthorColor('#38bdf8');
    } else if (type === 'gold') {
      setHueRotate(45);
      setSaturation(135);
      setColorTemperature(15);
      setContrast(125);
      setCustomAuthorColor('#ffd700');
    } else if (type === 'emerald') {
      setHueRotate(120);
      setSaturation(140);
      setColorTemperature(-15);
      setContrast(115);
      setCustomAuthorColor('#22c55e');
    } else if (type === 'obsidian') {
      setHueRotate(270);
      setSaturation(90);
      setColorTemperature(-20);
      setContrast(140);
      setCustomAuthorColor('#c084fc');
    }
  };

  // Reset Author Color & Filter Controls
  const handleResetFilters = () => {
    setHueRotate(0);
    setSaturation(120);
    setColorTemperature(0);
    setBrightness(100);
    setContrast(110);
    setGlowIntensity(0);
  };

  // Compute CSS filter string with temperature simulation
  // Temperature > 0 adds slight sepia warm tone, < 0 adds cool blue shift
  const tempSepia = colorTemperature > 0 ? (colorTemperature * 0.4) : 0;
  const tempHue = colorTemperature < 0 ? (colorTemperature * 0.8) : 0;
  const netHue = (hueRotate + tempHue + 360) % 360;

  const canvasFilterStyle = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) hue-rotate(${netHue}deg) sepia(${tempSepia}%) ${
    glowIntensity > 0 ? `drop-shadow(0 0 ${glowIntensity * 1.5}px ${customAuthorColor})` : ''
  }`;

  // Export current 1024x1024 Canvas with all baked author filters as PNG Data URL
  const exportBaked1024PngDataUrl = (): string => {
    const canvas = canvasRef.current;
    if (!canvas) return currentDataUrl;

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = 1024;
    exportCanvas.height = 1024;
    const exportCtx = exportCanvas.getContext('2d');
    if (!exportCtx) return canvas.toDataURL('image/png');

    exportCtx.filter = canvasFilterStyle;
    exportCtx.drawImage(canvas, 0, 0, 1024, 1024);

    return exportCanvas.toDataURL('image/png');
  };

  // Download 1024x1024 PNG
  const handleDownload1024Png = () => {
    const dataUrl = exportBaked1024PngDataUrl();
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${textureName || 'item_texture_1024'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Save 1024x1024 Texture into active project
  const handleSaveToProject = () => {
    const dataUrl = exportBaked1024PngDataUrl();
    const cleanId = (textureName || 'custom_item').toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const comp: AddonComponent = {
      id: `tex-${Date.now()}`,
      type: 'texture',
      name: textureName || 'AI 1024x1024 神級材質',
      identifier: `${activeProject?.namespace || 'custom'}:${cleanId}`,
      filePath: `RP/textures/items/${cleanId}.png`,
      contentJson: dataUrl,
      imageDataUrl: dataUrl,
      textureData: {
        width: 1024,
        height: 1024,
        palette: {},
        grid: [],
      },
    };
    onSaveTextureToProject(comp);
    setSuccessNotice(`✅ 已成功將 1024×1024 圖標寫入模組專案！路徑: RP/textures/items/${cleanId}.png`);
    setTimeout(() => {
      setSuccessNotice('');
      onClose();
    }, 1200);
  };

  // 1-Click Prompt Enhancer Helpers
  const appendPromptTag = (tag: string) => {
    setPrompt((prev) => (prev.includes(tag) ? prev : `${prev}，${tag}`));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="bg-[#141414] border border-[#2d2d2d] rounded-2xl w-full max-w-5xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden text-neutral-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#282828] bg-[#1a1a1a]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-sky-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-cyan-950/50">
              <Sparkles className="w-5 h-5 text-cyan-200 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  CraftGPT 1024×1024 超高畫質神級圖標工坊
                </h2>
                <span className="text-[10px] font-mono font-semibold uppercase px-2.5 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 shadow-sm">
                  1024×1024 HD
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-950/70 text-indigo-300 border border-indigo-800/50">
                  2048+ 全色階漸層深度
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                AI 自動分析全光譜色彩與多階漸層光影，作者可自由調節色調、色溫與立體層次
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-[#282828] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: AI Prompt & Color Control Studio */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            
            {/* 1. Main AI Prompt */}
            <div className="p-4 rounded-xl bg-[#191919] border border-[#2b2b2b]">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>AI 提示詞 (Prompt)</span>
                </label>
                <span className="text-[10px] text-cyan-400/80 font-mono">自動分析 2048+ 色譜</span>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="請輸入想要 AI 繪製的盾牌、武器、神器或防具，例如：熾炎泰坦重裝神聖守護盾牌，金屬浮雕，龍鱗裝甲，燃燒熔岩符文..."
                rows={3}
                className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500 transition-colors resize-none leading-relaxed"
              />

              {/* Quick Quality Inspiration Chips */}
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => appendPromptTag('重裝合金浮雕與多層漸層龍鱗')}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-[#222] hover:bg-[#2e2e2e] text-neutral-300 border border-[#383838] transition-colors cursor-pointer"
                >
                  + 多層浮雕龍鱗
                </button>
                <button
                  type="button"
                  onClick={() => appendPromptTag('2048色深層熔岩光雕符文')}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-[#222] hover:bg-[#2e2e2e] text-neutral-300 border border-[#383838] transition-colors cursor-pointer"
                >
                  + 深層熔岩光雕
                </button>
                <button
                  type="button"
                  onClick={() => appendPromptTag('神聖純金滾邊與立體金屬倒角')}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-[#222] hover:bg-[#2e2e2e] text-neutral-300 border border-[#383838] transition-colors cursor-pointer"
                >
                  + 金屬立體倒角
                </button>
              </div>

              <button
                onClick={handleGenerate1024Texture}
                disabled={isLoading || !prompt.trim()}
                className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-gradient-to-r from-cyan-600 via-sky-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-cyan-950/40 disabled:opacity-50 transition-all cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>AI 正在計算並生成 1024×1024 神級畫質...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    <span>開始 1024×1024 AI 生成</span>
                  </>
                )}
              </button>
            </div>

            {/* 2. AI Evolution & Modification Section (修改的地方) */}
            <div className="p-4 rounded-xl bg-[#191919] border border-[#2b2b2b]">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                  <span>AI 修改與微調進化 (Refine Prompt)</span>
                </label>
                <span className="text-[10px] text-neutral-500 font-mono">在此基礎上修改</span>
              </div>
              <textarea
                value={editInstruction}
                onChange={(e) => setEditInstruction(e.target.value)}
                placeholder="輸入您想修改的細節，例如：『盾面中央增加金屬巨龍徽記』、『盾牌邊框改為厚重黑曜石』、『增添熔岩微粒火花』..."
                rows={2}
                className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500 transition-colors resize-none leading-relaxed"
              />
              <button
                onClick={handleApplyAIEdit}
                disabled={isEditing || !editInstruction.trim() || !currentDataUrl}
                className="mt-2.5 w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-[#272727] hover:bg-[#323232] border border-cyan-800/60 text-cyan-300 hover:text-white text-xs font-semibold disabled:opacity-40 transition-all cursor-pointer"
              >
                {isEditing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>AI 正在昇華重構圖像中...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>套用 AI 修改進化</span>
                  </>
                )}
              </button>
            </div>

            {/* 3. Author's Color & Gradient Tuning Studio (作者專屬調色工作室) */}
            <div className="p-4 rounded-xl bg-[#191919] border border-[#2b2b2b] flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-[#292929] pb-2">
                <span className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-amber-400" />
                  <span>作者全色譜漸層調色盤 (2048+ 色域)</span>
                </span>
                <button
                  onClick={handleResetFilters}
                  className="text-[11px] text-neutral-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>重設</span>
                </button>
              </div>

              {/* Tone Quick Presets */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => applyTonePreset('magma')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#261510] hover:bg-[#341d16] text-amber-300 border border-amber-900/50 cursor-pointer shrink-0"
                >
                  <Flame className="w-3 h-3 text-orange-400" />
                  <span>熾炎熔岩</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyTonePreset('celestial')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#101b2a] hover:bg-[#15253b] text-cyan-300 border border-cyan-900/50 cursor-pointer shrink-0"
                >
                  <Moon className="w-3 h-3 text-cyan-400" />
                  <span>星穹虛空</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyTonePreset('gold')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#262010] hover:bg-[#352c15] text-yellow-300 border border-yellow-900/50 cursor-pointer shrink-0"
                >
                  <Sun className="w-3 h-3 text-yellow-400" />
                  <span>聖輝純金</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyTonePreset('emerald')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#0f2416] hover:bg-[#153420] text-emerald-300 border border-emerald-900/50 cursor-pointer shrink-0"
                >
                  <Gem className="w-3 h-3 text-emerald-400" />
                  <span>翡翠原石</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyTonePreset('obsidian')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#1f1226] hover:bg-[#2b1935] text-purple-300 border border-purple-900/50 cursor-pointer shrink-0"
                >
                  <Shield className="w-3 h-3 text-purple-400" />
                  <span>暗夜黑曜</span>
                </button>
              </div>

              {/* Sliders Grid */}
              <div className="grid grid-cols-2 gap-3 text-[11px] mt-1">
                {/* 1. Master Hue Spectrum */}
                <div className="col-span-2">
                  <div className="flex justify-between text-neutral-400 mb-1">
                    <span>主色相光譜環 (Master Hue Cycle)</span>
                    <span className="font-mono text-cyan-300">{hueRotate}°</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={360}
                    value={hueRotate}
                    onChange={(e) => setHueRotate(Number(e.target.value))}
                    className="w-full cursor-pointer h-2 rounded appearance-none"
                    style={{
                      background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)'
                    }}
                  />
                </div>

                {/* 2. Color Depth / Saturation */}
                <div>
                  <div className="flex justify-between text-neutral-400 mb-1">
                    <span>色彩豐富度 / 漸層深度</span>
                    <span className="font-mono text-cyan-300">{saturation}%</span>
                  </div>
                  <input
                    type="range"
                    min={50}
                    max={250}
                    value={saturation}
                    onChange={(e) => setSaturation(Number(e.target.value))}
                    className="w-full accent-cyan-500 cursor-pointer h-1 bg-[#333] rounded"
                  />
                </div>

                {/* 3. Color Temperature (冷暖色溫) */}
                <div>
                  <div className="flex justify-between text-neutral-400 mb-1">
                    <span>冷暖色溫</span>
                    <span className="font-mono text-cyan-300">
                      {colorTemperature > 0 ? `+${colorTemperature} 暖` : colorTemperature < 0 ? `${colorTemperature} 冷` : '標準'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-40}
                    max={40}
                    value={colorTemperature}
                    onChange={(e) => setColorTemperature(Number(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer h-1 bg-[#333] rounded"
                  />
                </div>

                {/* 4. Contrast & Shadow Depth */}
                <div>
                  <div className="flex justify-between text-neutral-400 mb-1">
                    <span>暗部層次與立體對比</span>
                    <span className="font-mono text-cyan-300">{contrast}%</span>
                  </div>
                  <input
                    type="range"
                    min={70}
                    max={170}
                    value={contrast}
                    onChange={(e) => setContrast(Number(e.target.value))}
                    className="w-full accent-cyan-500 cursor-pointer h-1 bg-[#333] rounded"
                  />
                </div>

                {/* 5. Brightness & Specular */}
                <div>
                  <div className="flex justify-between text-neutral-400 mb-1">
                    <span>高光亮度與金屬反光</span>
                    <span className="font-mono text-cyan-300">{brightness}%</span>
                  </div>
                  <input
                    type="range"
                    min={60}
                    max={150}
                    value={brightness}
                    onChange={(e) => setBrightness(Number(e.target.value))}
                    className="w-full accent-cyan-500 cursor-pointer h-1 bg-[#333] rounded"
                  />
                </div>

                {/* 6. Glow Bloom */}
                <div className="col-span-2">
                  <div className="flex justify-between text-neutral-400 mb-1">
                    <span>神聖光環輝光 (Aura Bloom)</span>
                    <span className="font-mono text-cyan-300">{glowIntensity}px</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={25}
                    value={glowIntensity}
                    onChange={(e) => setGlowIntensity(Number(e.target.value))}
                    className="w-full accent-cyan-500 cursor-pointer h-1 bg-[#333] rounded"
                  />
                </div>
              </div>
            </div>

            {/* Notification messages */}
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

          {/* Right Column: 1024x1024 High-Resolution Canvas Stage */}
          <div className="lg:col-span-7 flex flex-col bg-[#161616] border border-[#2b2b2b] rounded-2xl p-5 justify-between">
            
            {/* Top Toolbar */}
            <div className="w-full flex items-center justify-between pb-3 border-b border-[#252525] mb-3">
              
              {/* Item identifier input */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-400 font-medium">標識符:</span>
                <input
                  type="text"
                  value={textureName}
                  onChange={(e) => setTextureName(e.target.value)}
                  placeholder="custom_item"
                  className="bg-[#101010] border border-[#333] rounded px-2.5 py-1 font-mono text-xs text-cyan-300 focus:outline-none focus:border-cyan-500 w-44"
                />
              </div>

              {/* View options */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setZoomMode(zoomMode === 'fit' ? 'actual' : 'fit')}
                  className="p-1.5 rounded-lg bg-[#222] hover:bg-[#2c2c2c] text-neutral-300 text-xs flex items-center gap-1 transition-colors cursor-pointer border border-[#333]"
                  title={zoomMode === 'fit' ? '檢視 100% 原始尺寸' : '適應畫面'}
                >
                  <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{zoomMode === 'fit' ? '100% 細節' : '適應視窗'}</span>
                </button>
              </div>
            </div>

            {/* Touch-Up & Direct Color Picking Bar */}
            <div className="w-full flex items-center justify-between gap-3 pb-3 border-b border-[#242424] mb-3 overflow-x-auto text-xs">
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setCurrentTool('brush')}
                  className={`p-1.5 px-2.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer ${
                    currentTool === 'brush' ? 'bg-cyan-600 text-white font-semibold' : 'bg-[#222] text-neutral-400 hover:text-white'
                  }`}
                  title="畫筆微調"
                >
                  <Paintbrush className="w-3.5 h-3.5" />
                  <span>筆刷</span>
                </button>
                <button
                  onClick={() => setCurrentTool('eraser')}
                  className={`p-1.5 px-2.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer ${
                    currentTool === 'eraser' ? 'bg-cyan-600 text-white font-semibold' : 'bg-[#222] text-neutral-400 hover:text-white'
                  }`}
                  title="橡皮擦"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  <span>擦除</span>
                </button>
                <button
                  onClick={() => setCurrentTool('picker')}
                  className={`p-1.5 px-2.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer ${
                    currentTool === 'picker' ? 'bg-cyan-600 text-white font-semibold' : 'bg-[#222] text-neutral-400 hover:text-white'
                  }`}
                  title="色彩吸管"
                >
                  <Pipette className="w-3.5 h-3.5" />
                  <span>吸管</span>
                </button>
              </div>

              {/* Brush size & Custom color picker */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-1 text-[11px] text-neutral-400">
                  <span>粗細:</span>
                  <input
                    type="range"
                    min={4}
                    max={40}
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    className="w-16 accent-cyan-500 cursor-pointer h-1 bg-[#333] rounded"
                  />
                  <span className="font-mono text-neutral-300 w-5">{brushSize}px</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-neutral-400">取色:</span>
                  <input
                    type="color"
                    value={customAuthorColor}
                    onChange={(e) => setCustomAuthorColor(e.target.value)}
                    className="w-7 h-7 rounded border border-[#444] cursor-pointer bg-transparent"
                    title="作者自訂顏色 (支援 16.7M 全彩)"
                  />
                  <span className="font-mono text-[11px] text-neutral-300 uppercase">{customAuthorColor}</span>
                </div>
              </div>
            </div>

            {/* The 1024x1024 Interactive Canvas Stage */}
            <div className="flex-1 flex items-center justify-center min-h-[380px] max-h-[460px] overflow-auto rounded-xl bg-[#0b0b0b] border border-[#2e2e2e] p-2 relative shadow-inner">
              
              {/* Transparent Checkerboard Grid */}
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
                  onMouseDown={(e) => {
                    setIsMouseDown(true);
                    handleCanvasPointerEvent(e);
                  }}
                  onMouseMove={(e) => {
                    if (isMouseDown) handleCanvasPointerEvent(e);
                  }}
                  onMouseUp={() => setIsMouseDown(false)}
                  onMouseLeave={() => setIsMouseDown(false)}
                  style={{
                    filter: canvasFilterStyle,
                    width: '100%',
                    height: '100%',
                    display: 'block',
                    cursor: currentTool === 'picker' ? 'crosshair' : 'default',
                  }}
                />

                {/* Empty State Overlay */}
                {!currentDataUrl && !isLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-black/60 backdrop-blur-xs">
                    <Sparkles className="w-10 h-10 text-cyan-400 mb-2 animate-bounce" />
                    <span className="text-sm font-bold text-white mb-1">
                      等待 1024×1024 神級繪製
                    </span>
                    <span className="text-xs text-neutral-400 max-w-xs leading-relaxed">
                      請在左側輸入提示詞並點擊「開始 1024×1024 AI 生成」，AI 將自動分析 2048+ 色譜並繪製史詩立體圖標
                    </span>
                  </div>
                )}

                {/* Loading Spinner Overlay */}
                {(isLoading || isEditing) && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-black/75 backdrop-blur-xs z-10">
                    <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mb-3" />
                    <span className="text-sm font-bold text-white">
                      {isEditing ? 'AI 正在昇華深化細節與光影...' : 'AI 正在構建 1024×1024 超高畫質神級圖標...'}
                    </span>
                    <span className="text-xs text-cyan-300/80 font-mono mt-1">
                      計算 2048+ 色彩光譜・立體倒角金屬高光・多階漸層暗部遮蔽
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Info */}
            <div className="flex items-center justify-between text-[11px] text-neutral-400 mt-2 px-1">
              <span>原始解析度: 1024 × 1024 px (PNG / SVG)</span>
              <span>所有作者調色與光影設定將自動烘焙進下載圖檔中</span>
            </div>

          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#262626] bg-[#171717]">
          <span className="text-xs text-neutral-400 font-medium">
            {activeProject ? `目標專案: 「${activeProject.name}」` : '尚未指定專案'}
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownload1024Png}
              disabled={!currentDataUrl}
              className="flex items-center gap-1.5 py-2 px-4 rounded-xl bg-[#272727] hover:bg-[#333] text-neutral-200 text-xs font-medium border border-[#3d3d3d] disabled:opacity-40 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4 text-cyan-400" />
              <span>下載 1024×1024 HD PNG</span>
            </button>
            <button
              onClick={handleSaveToProject}
              disabled={!currentDataUrl}
              className="flex items-center gap-1.5 py-2 px-5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/50 disabled:opacity-40 transition-all cursor-pointer"
            >
              <FolderPlus className="w-4 h-4" />
              <span>加入當前模組材質庫</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
