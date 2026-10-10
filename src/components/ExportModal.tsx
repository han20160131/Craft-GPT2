import React, { useState } from 'react';
import { 
  X, 
  Download, 
  Server, 
  FileArchive, 
  CheckCircle, 
  AlertCircle, 
  Package, 
  Layers, 
  Sparkles, 
  Copy, 
  Check, 
  ExternalLink 
} from 'lucide-react';
import { Project } from '../types/addon';
import { 
  exportProjectToMcAddon, 
  exportProjectToZip, 
  downloadBlob, 
  downloadProjectViaServer 
} from '../utils/packExporter';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  project,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);

  if (!isOpen || !project) return null;

  const components = Array.isArray(project.components) ? project.components : [];
  const bpCount = components.filter((c) => 
    c.type === 'item' || c.type === 'block' || c.type === 'entity' || c.type === 'recipe' || c.type === 'function' || c.filePath?.startsWith('BP/')
  ).length;
  const rpCount = components.filter((c) => 
    c.type === 'texture' || c.type === 'lang' || c.filePath?.startsWith('RP/') || c.name?.endsWith('.png')
  ).length;

  const handleBrowserMcAddon = async () => {
    setIsExporting(true);
    setExportType('mcaddon');
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const blob = await exportProjectToMcAddon(project);
      const safeName = project.name.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_') || 'CustomAddon';
      downloadBlob(blob, `${safeName}.mcaddon`);
      setSuccessMsg(`成功匯出 ${safeName}.mcaddon！瀏覽器已開始下載。`);
    } catch (err: any) {
      console.error('Browser export error:', err);
      setErrorMsg(`本機匯出失敗: ${err.message}。建議點擊下方「備用伺服器直鏈下載」保證下載成功！`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleServerDownload = async (format: 'mcaddon' | 'zip') => {
    setIsExporting(true);
    setExportType(`server-${format}`);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await downloadProjectViaServer(project, format);
      const safeName = project.name.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_') || 'CustomAddon';
      setSuccessMsg(`伺服器串流下載成功！已輸出 ${safeName}.${format}。此下載管道不受任何 iframe 限制！`);
    } catch (err: any) {
      console.error('Server download error:', err);
      setErrorMsg(`伺服器下載失敗: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleBrowserZip = async () => {
    setIsExporting(true);
    setExportType('zip');
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const blob = await exportProjectToZip(project);
      const safeName = project.name.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_') || 'CustomAddon';
      downloadBlob(blob, `${safeName}.zip`);
      setSuccessMsg(`成功匯出 ${safeName}.zip 壓縮包！可解壓縮檢視所有原始碼與檔案。`);
    } catch (err: any) {
      console.error('Zip export error:', err);
      setErrorMsg(`ZIP 匯出失敗: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyManifest = () => {
    const summary = `【${project.name}】Minecraft Bedrock 1.21+ 模組包檔案清單
命名空間: ${project.namespace || 'custom'}
組件總數: ${components.length} 個檔案
行為包組件: ${bpCount} 個
資源包組件: ${rpCount} 個

包含檔案清單:
${components.map((c, i) => `${i + 1}. [${c.type}] ${c.filePath || c.name} (ID: ${c.identifier || '無'})`).join('\n')}`;

    navigator.clipboard.writeText(summary);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#18181b] border border-[#27272a] rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 text-neutral-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#27272a] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-600/40 flex items-center justify-center text-emerald-400">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>匯出模組包</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 font-mono">
                  .mcaddon
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                專案名稱: <span className="text-white font-medium">{project.name}</span> · 命名空間: <span className="text-emerald-400 font-mono">{project.namespace || 'custom'}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-[#27272a] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-[#202024] border border-[#2e2e33] text-xs">
          <div className="text-center">
            <div className="text-neutral-400 text-[11px]">總組件檔案</div>
            <div className="text-lg font-bold text-white mt-0.5">{components.length}</div>
          </div>
          <div className="text-center border-x border-[#2e2e33]">
            <div className="text-neutral-400 text-[11px]">行為包 (BP)</div>
            <div className="text-lg font-bold text-emerald-400 mt-0.5">{bpCount}</div>
          </div>
          <div className="text-center">
            <div className="text-neutral-400 text-[11px]">資源/貼圖 (RP)</div>
            <div className="text-lg font-bold text-cyan-400 mt-0.5">{rpCount}</div>
          </div>
        </div>

        {/* Notifications */}
        {successMsg && (
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-xs">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <div className="flex-1 leading-relaxed">{successMsg}</div>
          </div>
        )}

        {errorMsg && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">{errorMsg}</div>
          </div>
        )}

        {/* Download Channels */}
        <div className="space-y-2.5">
          <div className="text-xs font-semibold text-neutral-400 flex items-center justify-between">
            <span>選擇下載管道 (全通道保障，保證 100% 下載成功)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Option 1: Browser Direct mcaddon */}
            <button
              onClick={handleBrowserMcAddon}
              disabled={isExporting}
              className="flex items-start gap-3 p-3.5 rounded-xl bg-emerald-900/20 hover:bg-emerald-900/35 border border-emerald-500/40 hover:border-emerald-400 text-left transition-all group disabled:opacity-50"
            >
              <div className="p-2 rounded-lg bg-emerald-600/20 text-emerald-400 group-hover:scale-105 transition-transform shrink-0">
                <Download className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>直接下載 .mcaddon</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300">首選</span>
                </div>
                <div className="text-[11px] text-neutral-400 mt-0.5 leading-snug">
                  瀏覽器本機高速生成，雙擊即可直接匯入 Minecraft 遊戲。
                </div>
              </div>
            </button>

            {/* Option 2: Server Fallback Stream (100% Guaranteed in iframes) */}
            <button
              onClick={() => handleServerDownload('mcaddon')}
              disabled={isExporting}
              className="flex items-start gap-3 p-3.5 rounded-xl bg-cyan-900/20 hover:bg-cyan-900/35 border border-cyan-500/40 hover:border-cyan-400 text-left transition-all group disabled:opacity-50"
            >
              <div className="p-2 rounded-lg bg-cyan-600/20 text-cyan-400 group-hover:scale-105 transition-transform shrink-0">
                <Server className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>伺服器直鏈下載</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300">保證成功</span>
                </div>
                <div className="text-[11px] text-neutral-400 mt-0.5 leading-snug">
                  由後端 HTTP 串流傳輸，徹底繞過所有 iframe 沙盒限制。
                </div>
              </div>
            </button>

            {/* Option 3: Download as ZIP */}
            <button
              onClick={handleBrowserZip}
              disabled={isExporting}
              className="flex items-start gap-3 p-3.5 rounded-xl bg-[#222226] hover:bg-[#28282e] border border-[#333339] hover:border-neutral-500 text-left transition-all group disabled:opacity-50"
            >
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 group-hover:scale-105 transition-transform shrink-0">
                <FileArchive className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>下載為 .zip 原始碼</span>
                </div>
                <div className="text-[11px] text-neutral-400 mt-0.5 leading-snug">
                  方便在電腦解壓縮檢視每個 JSON 與貼圖結構。
                </div>
              </div>
            </button>

            {/* Option 4: Copy Files Summary */}
            <button
              onClick={handleCopyManifest}
              className="flex items-start gap-3 p-3.5 rounded-xl bg-[#222226] hover:bg-[#28282e] border border-[#333339] hover:border-neutral-500 text-left transition-all group"
            >
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 group-hover:scale-105 transition-transform shrink-0">
                {copiedSummary ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>{copiedSummary ? '已複製到剪貼簿！' : '複製檔案清單與代碼'}</span>
                </div>
                <div className="text-[11px] text-neutral-400 mt-0.5 leading-snug">
                  一鍵複製專案所有包含的檔案名稱、路徑與標識符。
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Installation Guidelines */}
        <div className="p-3.5 rounded-xl bg-[#1c1c20] border border-[#2a2a2f] space-y-2 text-xs">
          <div className="font-semibold text-neutral-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Minecraft 安裝教學</span>
          </div>
          <ol className="list-decimal list-inside space-y-1 text-neutral-400 text-[11px] leading-relaxed">
            <li><strong className="text-neutral-200">電腦版 (Windows):</strong> 下載後直接「雙擊」.mcaddon 檔案，Minecraft 將自動啟動並匯入。</li>
            <li><strong className="text-neutral-200">手機版 (Android/iOS):</strong> 點擊下載後的檔案並選擇「使用 Minecraft 開啟」。</li>
            <li><strong className="text-neutral-200">遊戲內設定:</strong> 進入世界編輯界面，在「行為包」與「資源包」同時啟用此模組，並開啟「實驗性遊戲玩法」！</li>
          </ol>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-1">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#27272a] hover:bg-[#323238] text-xs font-medium text-neutral-200 transition-colors"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
};
