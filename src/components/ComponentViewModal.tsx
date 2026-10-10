import React, { useState } from 'react';
import { X, FileCode, Copy, Check, Trash2, Download } from 'lucide-react';
import { AddonComponent } from '../types/addon';

interface ComponentViewModalProps {
  component: AddonComponent | null;
  onClose: () => void;
  onDeleteComponent?: (id: string) => void;
  onAskAIAboutComponent?: (comp: AddonComponent) => void;
}

export const ComponentViewModal: React.FC<ComponentViewModalProps> = ({
  component,
  onClose,
  onDeleteComponent,
  onAskAIAboutComponent,
}) => {
  const [copied, setCopied] = useState(false);

  if (!component) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(component.contentJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([component.contentJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = component.filePath.split('/').pop() || 'component.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="bg-[#1e1e1e] border border-[#333] rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 text-neutral-200 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-[#2d2d2d] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <FileCode className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white flex items-center gap-2">
                <span>{component.name}</span>
                <span className="text-[10px] font-mono uppercase bg-[#2a2a2a] px-1.5 py-0.5 rounded text-neutral-400">
                  {component.type}
                </span>
              </div>
              <div className="text-[11px] font-mono text-emerald-400">
                {component.filePath}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-neutral-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Code Content */}
        <div className="relative rounded-xl bg-[#121212] border border-[#262626] overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 bg-[#171717] border-b border-[#262626] text-xs">
            <span className="font-mono text-neutral-400">{component.identifier}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#262626] hover:bg-[#333] text-xs text-neutral-300 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? '已複製' : '複製代碼'}</span>
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#262626] hover:bg-[#333] text-xs text-neutral-300 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>下載檔案</span>
              </button>
            </div>
          </div>
          <pre className="p-4 text-xs font-mono text-neutral-200 overflow-x-auto max-h-80 leading-relaxed">
            <code>{component.contentJson}</code>
          </pre>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-2">
          {onDeleteComponent && (
            <button
              onClick={() => {
                onDeleteComponent(component.id);
                onClose();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 text-xs transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>從模組中移除此檔案</span>
            </button>
          )}

          <div className="flex items-center gap-2 ml-auto">
            {onAskAIAboutComponent && (
              <button
                onClick={() => {
                  onAskAIAboutComponent(component);
                  onClose();
                }}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
              >
                請 AI 修改或擴充此檔案
              </button>
            )}
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg bg-[#2a2a2a] hover:bg-[#333] text-neutral-300 text-xs font-medium transition-colors"
            >
              關閉
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
