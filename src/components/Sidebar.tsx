import React, { useState } from 'react';
import { 
  SquarePen, 
  PanelLeftClose, 
  Trash2, 
  Edit2, 
  FolderPlus, 
  Folder, 
  FolderOpen,
  MessageSquare, 
  Check, 
  X,
  User as UserIcon,
  Cloud,
  ChevronDown,
  ChevronRight,
  Plus,
  FileCode,
  Package,
  Download,
  Upload,
  Layers,
  Sparkles,
  FileText,
  Paintbrush,
  Image as ImageIcon
} from 'lucide-react';
import { AppUser } from '../services/cloudStorage';
import { Project, ChatSession, AddonComponent } from '../types/addon';
import { ProjectFolderTree } from './ProjectFolderTree';

interface SidebarProps {
  isOpen: boolean;
  onToggleOpen: () => void;
  projects: Project[];
  activeProjectId: string;
  onSelectProject: (projectId: string) => void;
  onOpenCreateProject: () => void;
  sessions: ChatSession[];
  activeSessionId: string;
  onSelectSession: (sessionId: string) => void;
  onNewChatInProject: (projectId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, newTitle: string) => void;
  onDeleteProject: (projectId: string) => void;
  onExportProject: (project: Project) => void;
  onViewComponent: (comp: AddonComponent) => void;
  onOpenImportModal: () => void;
  onOpenTextureModal?: () => void;
  currentUser: AppUser | null;
  onOpenAuth: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onToggleOpen,
  projects,
  activeProjectId,
  onSelectProject,
  onOpenCreateProject,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChatInProject,
  onDeleteSession,
  onRenameSession,
  onDeleteProject,
  onExportProject,
  onViewComponent,
  onOpenImportModal,
  onOpenTextureModal,
  currentUser,
  onOpenAuth,
}) => {
  // Folder expansion state: projectId -> boolean (default true for all projects)
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    projects.forEach((p) => {
      initial[p.id] = true;
    });
    return initial;
  });

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitleInput, setEditTitleInput] = useState<string>('');

  const toggleFolder = (projectId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedFolders((prev) => ({
      ...prev,
      [projectId]: prev[projectId] === undefined ? false : !prev[projectId],
    }));
  };

  const startRename = (id: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(id);
    setEditTitleInput(currentTitle);
  };

  const confirmRename = (id: string, e?: React.FormEvent) => {
    e?.preventDefault();
    if (editTitleInput.trim()) {
      onRenameSession(id, editTitleInput.trim());
    }
    setEditingSessionId(null);
  };

  if (!isOpen) return null;

  return (
    <aside className="w-80 h-full bg-[#171717] border-r border-[#262626] flex flex-col shrink-0 text-[#ececec] select-none z-20">
      {/* Top Header: New Module Folder + Quick New Chat */}
      <div className="p-3 border-b border-[#262626] space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-emerald-600 flex items-center justify-center text-white text-xs font-bold">
              C
            </div>
            <span className="font-semibold text-sm text-white">CraftGPT 模組庫</span>
          </div>

          <button
            onClick={onToggleOpen}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-[#262626] transition-colors"
            title="收合側邊欄"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* Action Buttons: 增加模組資料夾 & 在當前模組開新對話 */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={onOpenCreateProject}
            className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg bg-[#212121] hover:bg-[#2a2a2a] border border-[#2f2f2f] hover:border-emerald-500/50 text-xs font-medium text-emerald-400 transition-colors"
            title="增加新的 Minecraft 模組資料夾"
          >
            <FolderPlus className="w-4 h-4 shrink-0" />
            <span className="truncate">新增模組資料夾</span>
          </button>

          <button
            onClick={() => onNewChatInProject(activeProjectId)}
            className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white transition-colors shadow-sm"
            title="在當前模組建立新對話"
          >
            <SquarePen className="w-4 h-4 shrink-0" />
            <span className="truncate">新對話</span>
          </button>
        </div>
      </div>

      {/* Main Folder Tree: Modules as Expandable Folders */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-3">
        <div className="px-2 pt-1 pb-0.5 text-[11px] font-semibold text-neutral-400 flex items-center justify-between">
          <span>模組資料夾樹 (MODULES)</span>
          <span className="text-[10px] text-neutral-500 font-mono">{projects.length} 個模組</span>
        </div>

        {projects.length === 0 && (
          <div className="p-4 text-center rounded-xl bg-[#141414] border border-[#262626] space-y-2.5 mt-2">
            <p className="text-xs text-neutral-400 leading-relaxed">
              {currentUser 
                ? '此帳號目前尚無模組專案，點擊下方按鈕開始建立！' 
                : '尚未登入帳號。登入後即可載入專屬於您的模組專案。'}
            </p>
            {currentUser ? (
              <button
                onClick={onOpenCreateProject}
                className="w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
              >
                + 建立新模組專案
              </button>
            ) : (
              <button
                onClick={onOpenAuth}
                className="w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
              >
                登入 / 建立帳號
              </button>
            )}
          </div>
        )}

        {projects.map((project) => {
          const isSelectedProject = project.id === activeProjectId;
          const isExpanded = expandedFolders[project.id] !== false; // default expanded
          const projectSessions = sessions.filter((s) => s.projectId === project.id);
          const components = project.components || [];

          return (
            <div 
              key={project.id}
              className={`rounded-xl border transition-all ${
                isSelectedProject 
                  ? 'bg-[#1a1a1a] border-emerald-500/40 shadow-sm' 
                  : 'bg-[#161616] border-[#222222] hover:border-[#2a2a2a]'
              }`}
            >
              {/* Folder Row Header - Clickable to expand/collapse downward */}
              <div
                onClick={() => {
                  onSelectProject(project.id);
                  toggleFolder(project.id);
                }}
                className={`group flex items-center justify-between px-3 py-2.5 cursor-pointer rounded-t-xl hover:bg-[#222222] transition-colors ${
                  !isExpanded ? 'rounded-b-xl' : ''
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {/* Downward Expansion Chevron (向下伸展按鈕) */}
                  <button
                    onClick={(e) => toggleFolder(project.id, e)}
                    className="p-1 rounded text-neutral-400 hover:text-white hover:bg-[#2b2b2b] transition-colors"
                    title={isExpanded ? '點擊收合模組' : '點擊向下展開模組內容'}
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-neutral-400" />
                    )}
                  </button>

                  {/* Folder Icon */}
                  {isExpanded ? (
                    <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
                  ) : (
                    <Folder className="w-4 h-4 text-amber-500/80 shrink-0" />
                  )}

                  {/* Module Name and count badge */}
                  <div className="min-w-0">
                    <div className={`text-xs font-semibold truncate ${
                      isSelectedProject ? 'text-white' : 'text-neutral-300'
                    }`}>
                      {project.name}
                    </div>
                    <div className="text-[10px] text-neutral-500 flex items-center gap-1.5">
                      <span>{projectSessions.length} 個對話</span>
                      <span>·</span>
                      <span className="text-emerald-400/80">{components.length} 個檔案</span>
                    </div>
                  </div>
                </div>

                {/* Folder Quick Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {/* New Chat in this Module */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectProject(project.id);
                      onNewChatInProject(project.id);
                      setExpandedFolders((prev) => ({ ...prev, [project.id]: true }));
                    }}
                    className="p-1.5 rounded text-neutral-400 hover:text-emerald-300 hover:bg-[#2c2c2c] transition-colors"
                    title="在此模組下開新對話"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>

                  {/* Export this Module */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onExportProject(project);
                    }}
                    className="p-1.5 rounded text-neutral-400 hover:text-white hover:bg-[#2c2c2c] transition-colors"
                    title="匯出此模組 (.mcaddon)"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete Module button */}
                  {projects.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteProject(project.id);
                      }}
                      className="p-1.5 rounded text-neutral-400 hover:text-rose-400 hover:bg-[#2c2c2c] transition-colors opacity-0 group-hover:opacity-100"
                      title="刪除模組資料夾"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Downward Expandable Content Area (模組向下伸展的內部對話與組件檔案) */}
              {isExpanded && (
                <div className="px-3 pb-3 pt-1 border-t border-[#242424] space-y-3.5">
                  {/* 1. 對話清單 (Chats inside this Module) */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-medium text-neutral-400 px-1 pt-1">
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3 text-neutral-400" />
                        <span>對話列表</span>
                      </span>
                      <button
                        onClick={() => {
                          onSelectProject(project.id);
                          onNewChatInProject(project.id);
                        }}
                        className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5 px-1.5 py-0.5 rounded hover:bg-[#242424]"
                      >
                        <Plus className="w-3 h-3" />
                        <span>新對話</span>
                      </button>
                    </div>

                    {projectSessions.length === 0 ? (
                      <div 
                        onClick={() => {
                          onSelectProject(project.id);
                          onNewChatInProject(project.id);
                        }}
                        className="p-2 rounded-lg bg-[#121212] hover:bg-[#1a1a1a] border border-dashed border-[#2c2c2c] text-center cursor-pointer text-[11px] text-neutral-400 transition-colors"
                      >
                        點此開啟該模組的第一個對話
                      </div>
                    ) : (
                      <div className="space-y-0.5">
                        {projectSessions.map((session) => {
                          const isSelectedChat = session.id === activeSessionId;
                          const isEditing = editingSessionId === session.id;

                          if (isEditing) {
                            return (
                              <form
                                key={session.id}
                                onSubmit={(e) => confirmRename(session.id, e)}
                                className="flex items-center gap-1 p-1 bg-[#262626] rounded-md"
                              >
                                <input
                                  type="text"
                                  value={editTitleInput}
                                  onChange={(e) => setEditTitleInput(e.target.value)}
                                  autoFocus
                                  className="flex-1 bg-transparent border-0 text-xs text-white focus:outline-none px-1"
                                />
                                <button type="submit" className="p-1 text-emerald-400 hover:text-emerald-300">
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button type="button" onClick={() => setEditingSessionId(null)} className="p-1 text-neutral-400 hover:text-white">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </form>
                            );
                          }

                          return (
                            <div
                              key={session.id}
                              onClick={() => {
                                onSelectProject(project.id);
                                onSelectSession(session.id);
                              }}
                              className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                                isSelectedChat
                                  ? 'bg-emerald-950/70 border border-emerald-500/50 text-white font-medium'
                                  : 'text-neutral-300 hover:text-white hover:bg-[#222222]'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${
                                  isSelectedChat ? 'text-emerald-400' : 'text-neutral-500'
                                }`} />
                                <span className="truncate">{session.title}</span>
                              </div>

                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={(e) => startRename(session.id, session.title, e)}
                                  className="p-1 text-neutral-400 hover:text-white"
                                  title="重新命名對話"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteSession(session.id);
                                  }}
                                  className="p-1 text-neutral-400 hover:text-rose-400"
                                  title="刪除此對話"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 2. 模組完整資料夾目錄樹 (可向下展開的 BP、RP、README 完整結構) */}
                  <div className="space-y-1.5 pt-2 border-t border-[#222222]">
                    <div className="flex items-center justify-between text-[11px] font-medium text-neutral-400 px-1">
                      <span className="flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-amber-400" />
                        <span>模組檔案目錄樹 ({components.length})</span>
                      </span>
                      <button
                        onClick={onOpenImportModal}
                        className="text-[10px] text-neutral-400 hover:text-emerald-400 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-[#242424]"
                        title="匯入 .mcaddon 或 .json 至此模組"
                      >
                        <Upload className="w-3 h-3" />
                        <span>匯入</span>
                      </button>
                    </div>

                    <ProjectFolderTree
                      project={project}
                      onViewComponent={onViewComponent}
                      onExportProject={onExportProject}
                      compact={true}
                    />
                  </div>

                  {/* 3. 模組快速工具按鈕 */}
                  <div className="pt-1 flex items-center gap-1.5">
                    {onOpenTextureModal && (
                      <button
                        onClick={onOpenTextureModal}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-[#222222] hover:bg-[#2a2a2a] border border-cyan-900/40 text-[11px] font-medium text-cyan-300 hover:text-cyan-200 transition-colors"
                        title="為此模組製作 1024×1024 神級材質圖標"
                      >
                        <Paintbrush className="w-3 h-3 text-cyan-400" />
                        <span>+ 1024圖標</span>
                      </button>
                    )}
                    <button
                      onClick={() => onExportProject(project)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-[#222222] hover:bg-[#2a2a2a] border border-[#2e2e2e] text-[11px] font-medium text-neutral-300 hover:text-white transition-colors"
                      title="下載 .mcaddon 檔"
                    >
                      <Download className="w-3 h-3 text-emerald-400" />
                      <span>匯出 .mcaddon</span>
                    </button>
                    <button
                      onClick={onOpenImportModal}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-[#222222] hover:bg-[#2a2a2a] border border-[#2e2e2e] text-[11px] font-medium text-neutral-300 hover:text-white transition-colors"
                      title="匯入模組檔案"
                    >
                      <Upload className="w-3 h-3 text-amber-400" />
                      <span>匯入檔案</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom User Account & Cloud Sync Bar */}
      <div 
        onClick={onOpenAuth}
        className="p-3 border-t border-[#262626] bg-[#141414] hover:bg-[#1c1c1c] cursor-pointer flex items-center justify-between text-xs text-neutral-300 transition-colors"
        title="點擊管理帳號與登入"
      >
        <div className="flex items-center gap-2.5 truncate">
          <div className="w-7 h-7 rounded-full bg-emerald-700 border border-emerald-500/40 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {currentUser?.email ? currentUser.email[0].toUpperCase() : <UserIcon className="w-3.5 h-3.5" />}
          </div>
          <div className="truncate">
            <div className="font-medium text-white truncate text-xs">
              {currentUser ? (currentUser.displayName || currentUser.email) : '尚未登入 (點此登入 / 建立帳號)'}
            </div>
            <div className="text-[10px] text-emerald-400 flex items-center gap-1">
              <Cloud className="w-3 h-3" />
              <span>{currentUser ? '帳號已綁定 · 雲端同步中' : '點擊登入以載入專案'}</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
