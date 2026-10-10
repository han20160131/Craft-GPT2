import React from 'react';
import { X, Sparkles, Brain, Activity, Clock, Cpu, CheckCircle2, ShieldCheck } from 'lucide-react';

export interface ThoughtLogEntry {
  id: string;
  timestamp: number;
  type: 'thought' | 'action' | 'info';
  step?: string;
  detail: string;
}

interface ThoughtInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  isStreaming: boolean;
  currentAction: string;
  thoughtLogs: ThoughtLogEntry[];
  elapsedMs: number;
  tokenCount: number;
}

export const ThoughtInspectorModal: React.FC<ThoughtInspectorModalProps> = ({
  isOpen,
  onClose,
  isStreaming,
  currentAction,
  thoughtLogs,
  elapsedMs,
  tokenCount,
}) => {
  if (!isOpen) return null;

  const seconds = (elapsedMs / 1000).toFixed(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[#1a1a1a] border border-[#333] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-neutral-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2d2d2d] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white shadow-md">
              <Brain className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <span>CraftGPT 思維與行動監控器</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${
                  isStreaming
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40 animate-pulse'
                    : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                }`}>
                  {isStreaming ? '● 正在思考生成中' : '○ 準備就緒'}
                </span>
              </h2>
              <p className="text-[11px] text-neutral-400">
                即時透視 AI 當前的推理解析步驟與 Minecraft 模組建構流程
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-[#262626] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Live Action Banner */}
        <div className="p-3.5 rounded-xl bg-[#242424] border border-[#353535] space-y-1.5">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span className="flex items-center gap-1.5 font-medium text-emerald-400">
              <Activity className="w-3.5 h-3.5" />
              <span>當前執行動作</span>
            </span>
            <span className="font-mono text-[11px] text-neutral-400">
              {isStreaming ? `已耗時 ${seconds} 秒` : '最後狀態'}
            </span>
          </div>
          <div className="text-sm font-medium text-white pl-5">
            {isStreaming ? (currentAction || '正在進行神經網路推論與 JSON 架構建置...') : '已完成當前輪次生成，隨時可接收新指令。'}
          </div>
        </div>

        {/* Real-time Telemetry Stats */}
        <div className="grid grid-cols-3 gap-2.5 text-center">
          <div className="p-2.5 rounded-lg bg-[#212121] border border-[#2d2d2d]">
            <div className="text-[10px] text-neutral-400 mb-0.5 flex items-center justify-center gap-1">
              <Clock className="w-3 h-3 text-sky-400" />
              <span>總運行時間</span>
            </div>
            <div className="font-mono text-sm font-bold text-white">{seconds}s</div>
          </div>

          <div className="p-2.5 rounded-lg bg-[#212121] border border-[#2d2d2d]">
            <div className="text-[10px] text-neutral-400 mb-0.5 flex items-center justify-center gap-1">
              <Cpu className="w-3 h-3 text-emerald-400" />
              <span>生成標記數</span>
            </div>
            <div className="font-mono text-sm font-bold text-emerald-400">{tokenCount}</div>
          </div>

          <div className="p-2.5 rounded-lg bg-[#212121] border border-[#2d2d2d]">
            <div className="text-[10px] text-neutral-400 mb-0.5 flex items-center justify-center gap-1">
              <ShieldCheck className="w-3 h-3 text-amber-400" />
              <span>模組標準</span>
            </div>
            <div className="font-mono text-xs font-semibold text-neutral-200 mt-0.5">Bedrock 1.21+</div>
          </div>
        </div>

        {/* Thought Log Timeline */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-neutral-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>即時思考歷程紀錄 (Thought Process Timeline)</span>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-2 pr-1 rounded-xl p-3 bg-[#141414] border border-[#262626]">
            {thoughtLogs.length === 0 ? (
              <div className="text-xs text-neutral-400 text-center py-4">
                發送訊息時，此處將逐條展示 AI 的思考推理與程式碼生成日誌。
              </div>
            ) : (
              thoughtLogs.map((log) => (
                <div key={log.id} className="text-xs flex items-start gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                  <div className="flex-1">
                    {log.step && (
                      <span className="text-[11px] font-semibold text-emerald-400 font-mono mr-2">
                        [{log.step}]
                      </span>
                    )}
                    <span className="text-neutral-300 leading-relaxed">{log.detail}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Close Button */}
        <div className="flex justify-end pt-1">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[#2a2a2a] hover:bg-[#333] text-xs font-medium text-white transition-colors"
          >
            關閉視窗
          </button>
        </div>
      </div>
    </div>
  );
};
