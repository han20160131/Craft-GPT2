import React, { useState, useRef } from 'react';
import { X, Upload, FileCode, CheckCircle, AlertCircle, Package } from 'lucide-react';
import { importAddonFile } from '../utils/packImporter';
import { AddonComponent } from '../types/addon';

interface AddonImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (components: AddonComponent[], suggestedName?: string) => void;
}

export const AddonImportModal: React.FC<AddonImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [importedItems, setImportedItems] = useState<AddonComponent[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleProcessFile = async (file: File) => {
    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const result = await importAddonFile(file);
      if (result.components.length === 0) {
        throw new Error('未在此檔案中偵測到任何 Minecraft Bedrock 模組檔案。若此為 .mcaddon 或 .mcpack，請確認壓縮包是否包含行為包 (BP)、材質包 (RP) 或 .json 相關檔案。');
      }
      setImportedItems(result.components);
      onImportSuccess(result.components, result.projectName);
    } catch (err: any) {
      setErrorMsg(err.message || '匯入失敗，請確認檔案格式是否正確。');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleProcessFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleProcessFile(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="bg-[#1e1e1e] border border-[#333] rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-[#333] pb-3">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-semibold text-white">
              匯入基岩版 Add-on 模組
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-neutral-400">
          支援匯入現有的 <span className="text-emerald-400 font-mono">.mcaddon</span>、
          <span className="text-emerald-400 font-mono">.mcpack</span>、
          <span className="text-emerald-400 font-mono">.zip</span> 或單一 <span className="text-emerald-400 font-mono">.json</span> 檔案。
        </p>

        {/* Drop zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-emerald-500 bg-emerald-950/20'
              : 'border-[#3a3a3a] bg-[#171717] hover:border-neutral-500'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".mcaddon,.mcpack,.zip,.json"
            onChange={handleFileChange}
            className="hidden"
          />

          <Upload className="w-8 h-8 text-neutral-400 mb-2" />
          <p className="text-sm text-neutral-200 font-medium">
            點擊此處或拖曳檔案至此
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            .mcaddon, .mcpack, .zip, .json
          </p>
        </div>

        {isProcessing && (
          <div className="flex items-center justify-center gap-2 py-3 text-xs text-neutral-400">
            <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            <span>正在解析模組包結構...</span>
          </div>
        )}

        {errorMsg && (
          <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="whitespace-pre-line leading-relaxed">{errorMsg}</div>
          </div>
        )}

        <div className="p-3 rounded-lg bg-[#191919] border border-[#2c2c2c] text-[11px] text-neutral-400 space-y-1">
          <div className="font-semibold text-neutral-300 flex items-center gap-1">
            <span>💡 為什麼有些正版 .mcaddon 無法直接編輯？</span>
          </div>
          <p className="leading-relaxed">
            Minecraft 官方商城 (Marketplace) 出售的官方模組受到微軟 DRM 二進制加密保護，外部工具無法直接讀取密文。若要修改模組，請使用創作者發布之<strong>社群開源模組 (.mcaddon / .zip)</strong>，或直接向 CraftGPT 描述需求為您重新打造！
          </p>
        </div>

        {importedItems.length > 0 && (
          <div className="p-3 rounded bg-[#171717] border border-[#2a2a2a] space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              <CheckCircle className="w-4 h-4" />
              <span>成功匯入 {importedItems.length} 個模組組件！</span>
            </div>
            <div className="max-h-32 overflow-y-auto space-y-1 text-xs text-neutral-400">
              {importedItems.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-0.5">
                  <span className="text-neutral-300 truncate">{item.name}</span>
                  <span className="text-[10px] text-neutral-500 font-mono uppercase">{item.type}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-[#333]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
};
