import React, { useState } from 'react';
import { X, FolderPlus, Folder, Trash2, Check } from 'lucide-react';
import { Project } from '../types/addon';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  activeProjectId: string;
  onCreateProject: (name: string, namespace: string, desc: string) => void;
  onSelectProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  onClose,
  projects,
  activeProjectId,
  onCreateProject,
  onSelectProject,
  onDeleteProject,
}) => {
  const [name, setName] = useState('');
  const [namespace, setNamespace] = useState('custom');
  const [description, setDescription] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreateProject(name.trim(), namespace.trim() || 'custom', description.trim());
    setName('');
    setDescription('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="bg-[#1e1e1e] border border-[#333] rounded-xl max-w-md w-full p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-[#333] pb-3">
          <div className="flex items-center gap-2">
            <FolderPlus className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-semibold text-white">增加模組專案</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Create form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">
              專案名稱
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：自訂武器擴充包"
              autoFocus
              className="w-full bg-[#141414] border border-[#383838] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">
              命名空間 (Namespace)
            </label>
            <input
              type="text"
              value={namespace}
              onChange={(e) => setNamespace(e.target.value)}
              placeholder="custom"
              className="w-full bg-[#141414] border border-[#383838] rounded-lg px-3 py-2 text-sm font-mono text-emerald-400 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">
              專案簡介 (選填)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="簡述此模組特色..."
              className="w-full bg-[#141414] border border-[#383838] rounded-lg px-3 py-2 text-sm text-neutral-300 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-[#2a2a2a] hover:bg-[#333] text-neutral-300 text-xs font-medium transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-medium transition-colors"
            >
              建立專案
            </button>
          </div>
        </form>

        {/* Existing projects list */}
        <div className="pt-3 border-t border-[#333]">
          <div className="text-xs font-semibold text-neutral-400 mb-2">
            已建立的專案 ({projects.length})
          </div>
          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {projects.map((p) => {
              const isSelected = p.id === activeProjectId;
              return (
                <div
                  key={p.id}
                  onClick={() => onSelectProject(p.id)}
                  className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer border transition-colors ${
                    isSelected
                      ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                      : 'bg-[#171717] border-[#2b2b2b] text-neutral-300 hover:border-neutral-500'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Folder className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="font-medium truncate">{p.name}</span>
                    <span className="text-[10px] text-neutral-500 font-mono">({p.components.length} 組件)</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    {projects.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteProject(p.id);
                        }}
                        className="p-1 text-neutral-500 hover:text-rose-400 transition-colors"
                        title="刪除專案"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
