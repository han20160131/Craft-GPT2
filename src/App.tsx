/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Project, ChatSession, AddonComponent, ChatMessage, ThoughtLogEntry, GeneratedTexture, ExportDownloadBadge, AutoAppliedFilesSummary } from './types/addon';
import { Sidebar } from './components/Sidebar';
import { ChatWindow } from './components/ChatWindow';
import { ProjectModal } from './components/ProjectModal';
import { AddonImportModal } from './components/AddonImportModal';
import { ThoughtInspectorModal } from './components/ThoughtInspectorModal';
import { AuthModal } from './components/AuthModal';
import { ComponentViewModal } from './components/ComponentViewModal';
import { TextureGeneratorModal } from './components/TextureGeneratorModal';
import { exportProjectToMcAddon, downloadBlob } from './utils/packExporter';
import { 
  AppUser,
  subscribeToAuth, 
  subscribeToUserProjects, 
  subscribeToUserChats,
  saveProjectToCloud,
  deleteProjectFromCloud,
  saveChatToCloud,
  deleteChatFromCloud
} from './services/cloudStorage';

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isThoughtInspectorOpen, setIsThoughtInspectorOpen] = useState(false);
  const [isTextureModalOpen, setIsTextureModalOpen] = useState(false);
  const [initialTextureForModal, setInitialTextureForModal] = useState<GeneratedTexture | null>(null);
  const [inspectingComponent, setInspectingComponent] = useState<AddonComponent | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  // User Auth & Mode State
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Thought Inspector Global Stats
  const [currentAction, setCurrentAction] = useState<string>('等待使用者提問中...');
  const [globalThoughtLogs, setGlobalThoughtLogs] = useState<ThoughtLogEntry[]>([]);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [tokenCount, setTokenCount] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Projects State - Strictly isolated per-user, starts empty
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>('');

  // Sessions State - Strictly isolated per-user, starts empty
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');

  // 1. Subscribe to Auth
  useEffect(() => {
    const unsubscribe = subscribeToAuth((user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // 2. Sync projects and chats specifically for current user
  useEffect(() => {
    if (!currentUser) {
      // User logged out: completely clear projects and chats from screen!
      setProjects([]);
      setActiveProjectId('');
      setSessions([]);
      setActiveSessionId('');
      return;
    }

    // User logged in: sync exclusively that user's projects
    const unsubProjects = subscribeToUserProjects(currentUser.uid, (cloudProjects) => {
      setProjects(cloudProjects);
      if (cloudProjects.length > 0) {
        setActiveProjectId((prev) => {
          if (cloudProjects.some((p) => p.id === prev)) return prev;
          return cloudProjects[0].id;
        });
      } else {
        setActiveProjectId('');
      }
    });

    // Sync exclusively that user's chats
    const unsubChats = subscribeToUserChats(currentUser.uid, (cloudChats) => {
      setSessions(cloudChats);
      if (cloudChats.length > 0) {
        setActiveSessionId((prev) => {
          if (cloudChats.some((c) => c.id === prev)) return prev;
          return cloudChats[0].id;
        });
      } else {
        setActiveSessionId('');
      }
    });

    return () => {
      unsubProjects();
      unsubChats();
    };
  }, [currentUser]);

  // Active Project & Session
  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0] || null;
  const currentSession = sessions.find((s) => s.id === activeSessionId) || sessions.find((s) => s.projectId === activeProjectId) || sessions[0] || null;

  // Handle New Chat inside a specific Project (模組資料夾)
  const handleNewChatInProject = (projectId: string) => {
    const newSession: ChatSession = {
      id: `sess-${Date.now()}`,
      projectId,
      title: '新對話',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveProjectId(projectId);
    setActiveSessionId(newSession.id);

    if (currentUser) {
      saveChatToCloud(currentUser.uid, newSession);
    }
  };

  // Handle Rename Chat
  const handleRenameSession = (id: string, newTitle: string) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          const updated = { ...s, title: newTitle };
          if (currentUser) saveChatToCloud(currentUser.uid, updated);
          return updated;
        }
        return s;
      })
    );
  };

  // Handle Delete Chat
  const handleDeleteSession = (id: string) => {
    if (currentUser) {
      deleteChatFromCloud(currentUser.uid, id);
    }

    const remaining = sessions.filter((s) => s.id !== id);
    if (remaining.length === 0) {
      const emptySess: ChatSession = {
        id: `sess-${Date.now()}`,
        projectId: activeProjectId,
        title: '新對話',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [],
      };
      setSessions([emptySess]);
      setActiveSessionId(emptySess.id);
      if (currentUser) saveChatToCloud(currentUser.uid, emptySess);
    } else {
      setSessions(remaining);
      if (activeSessionId === id) {
        setActiveSessionId(remaining[0].id);
      }
    }
  };

  // Handle Create Project (模組資料夾)
  const handleCreateProject = (name: string, namespace: string, desc: string) => {
    const newProj: Project = {
      id: `proj-${Date.now()}`,
      name,
      namespace,
      description: desc,
      version: [1, 0, 0],
      createdAt: Date.now(),
      components: [],
    };
    setProjects((prev) => [...prev, newProj]);
    setActiveProjectId(newProj.id);

    if (currentUser) {
      saveProjectToCloud(currentUser.uid, newProj);
    }

    // Fresh chat for this module folder
    const newSession: ChatSession = {
      id: `sess-${Date.now()}`,
      projectId: newProj.id,
      title: '新對話',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);

    if (currentUser) {
      saveChatToCloud(currentUser.uid, newSession);
    }
  };

  // Handle Delete Project
  const handleDeleteProject = (id: string) => {
    if (projects.length <= 1) return;
    if (currentUser) {
      deleteProjectFromCloud(currentUser.uid, id);
    }
    const remaining = projects.filter((p) => p.id !== id);
    setProjects(remaining);
    if (activeProjectId === id) {
      setActiveProjectId(remaining[0].id);
    }
  };

  // Handle Add Component to Project
  const handleAddComponentToProject = (component: AddonComponent) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === activeProjectId) {
          const updated = {
            ...p,
            components: [
              ...p.components.filter((c) => c.identifier !== component.identifier),
              component,
            ],
          };
          if (currentUser) saveProjectToCloud(currentUser.uid, updated);
          return updated;
        }
        return p;
      })
    );
  };

  // Handle Delete Component from Project
  const handleDeleteComponentFromProject = (componentId: string) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === activeProjectId) {
          const updated = {
            ...p,
            components: p.components.filter((c) => c.id !== componentId),
          };
          if (currentUser) saveProjectToCloud(currentUser.uid, updated);
          return updated;
        }
        return p;
      })
    );
  };

  // Handle Ask AI about Component
  const handleAskAIAboutComponent = (comp: AddonComponent) => {
    handleSendMessage(`請針對我們模組中的檔案「${comp.filePath}」進行檢查與升級，這是目前的 JSON 代碼：\n\`\`\`json\n${comp.contentJson}\n\`\`\``);
  };

  // Handle Import Success
  const handleImportSuccess = (components: AddonComponent[], suggestedName?: string) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === activeProjectId) {
          const updated = {
            ...p,
            name: suggestedName || p.name,
            components: [...p.components, ...components],
          };
          if (currentUser) saveProjectToCloud(currentUser.uid, updated);
          return updated;
        }
        return p;
      })
    );
  };

  // Handle Export specific project
  const handleExportProject = async (projectToExport: Project) => {
    try {
      const blob = await exportProjectToMcAddon(projectToExport);
      const filename = `${projectToExport.name.replace(/\s+/g, '_') || 'CustomAddon'}.mcaddon`;
      downloadBlob(blob, filename);
    } catch (err: any) {
      alert(`匯出失敗: ${err.message}`);
    }
  };

  // Handle Send Message with Line-buffered SSE Streaming
  const handleSendMessage = async (text: string, imageBase64?: string) => {
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
      attachedImage: imageBase64,
    };

    const isFirstUserMsg = currentSession.messages.length === 0;
    const sessionTitle = isFirstUserMsg ? text.slice(0, 18) || '新對話' : currentSession.title;

    const assistantMsgId = `asst-${Date.now()}`;
    const initialThoughts: ThoughtLogEntry[] = [
      {
        id: `th-${Date.now()}-0`,
        timestamp: Date.now(),
        type: 'thought',
        step: '需求解析',
        detail: `收到指令「${text.slice(0, 28)}${text.length > 28 ? '...' : ''}」，開始分析基岩版規格...`,
      },
    ];

    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isThinking: true,
      currentAction: '正在解析提問與構思 Minecraft 模組架構...',
      thoughts: initialThoughts,
      elapsedSeconds: 0,
    };

    const targetSessionId = currentSession.id;
    const updatedMessages = [...currentSession.messages, userMsg];

    setSessions((prev) =>
      prev.map((s) =>
        s.id === targetSessionId
          ? {
              ...s,
              title: sessionTitle,
              updatedAt: Date.now(),
              messages: [...updatedMessages, assistantMsg],
            }
          : s
      )
    );

    setIsStreaming(true);
    setCurrentAction('正在解析提問與構思 Minecraft 模組架構...');
    setGlobalThoughtLogs(initialThoughts);
    setTokenCount(0);
    setElapsedMs(0);

    const startTime = Date.now();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const ms = Date.now() - startTime;
      setElapsedMs(ms);
      setSessions((prev) =>
        prev.map((s) =>
          s.id === targetSessionId
            ? {
                ...s,
                messages: s.messages.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, elapsedSeconds: ms / 1000 }
                    : m
                ),
              }
            : s
        )
      );
    }, 100);

    try {
      const projectToSend = projects.find((p) => p.id === currentSession?.projectId) || activeProject;

      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          imageBase64: imageBase64 || undefined,
          mimeType: imageBase64?.startsWith('data:image/jpeg') ? 'image/jpeg' : 'image/png',
          activeProject: projectToSend ? {
            id: projectToSend.id,
            name: projectToSend.name,
            namespace: projectToSend.namespace,
            components: projectToSend.components || [],
          } : null,
          systemPrompt: `當前使用者正在開發 Minecraft 基岩版 Add-on 模組資料夾「${projectToSend?.name || '模組專案'}」(命名空間: ${projectToSend?.namespace || 'custom'})。請針對 Bedrock 1.21+ 格式提供準確合法、可以直接放入行為包或材質包的代碼。`,
        }),
      });

      if (!response.ok) {
        throw new Error(`伺服器回應錯誤 (HTTP ${response.status})`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('無法建立資料串流讀取器');

      const decoder = new TextDecoder();
      let accumulatedContent = '';
      let activeThoughts = [...initialThoughts];
      let activeAction = '正在生成回覆內容...';
      const activeGeneratedTextures: GeneratedTexture[] = [];
      let activeExportBadge: ExportDownloadBadge | undefined = undefined;
      let activeAutoAppliedSummary: AutoAppliedFilesSummary | undefined = undefined;
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const dataStr = trimmed.slice(6);
          if (dataStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(dataStr);

            if (parsed.type === 'thought') {
              const newEntry: ThoughtLogEntry = {
                id: `th-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
                timestamp: parsed.timestamp || Date.now(),
                type: 'thought',
                step: parsed.step,
                detail: parsed.detail,
              };
              activeThoughts.push(newEntry);
              setGlobalThoughtLogs([...activeThoughts]);
            }

            if (parsed.type === 'action') {
              activeAction = parsed.action;
              setCurrentAction(parsed.action);
              if (parsed.tokens) setTokenCount(parsed.tokens);
              if (parsed.elapsedMs) setElapsedMs(parsed.elapsedMs);
            }

            if (parsed.type === 'texture' && parsed.texture) {
              activeGeneratedTextures.push(parsed.texture);
            }

            if (parsed.type === 'export_badge' && parsed.exportBadge) {
              activeExportBadge = parsed.exportBadge;
            }

            if (parsed.type === 'project_files_updated' && parsed.files) {
              activeAutoAppliedSummary = parsed.summary;
              const targetProjId = projectToSend?.id || activeProjectId;
              // Automatically write and sync files to active project folder!
              setProjects((prev) =>
                prev.map((p) => {
                  if (p.id === targetProjId) {
                    const existing = [...(p.components || [])];
                    for (const newFile of parsed.files) {
                      const idx = existing.findIndex(
                        (e) => e.filePath === newFile.filePath || (e.identifier && e.identifier === newFile.identifier)
                      );
                      if (idx >= 0) {
                        existing[idx] = newFile;
                      } else {
                        existing.push(newFile);
                      }
                    }
                    const updated = { ...p, components: existing };
                    if (currentUser) {
                      saveProjectToCloud(currentUser.uid, updated);
                    }
                    return updated;
                  }
                  return p;
                })
              );
            }

            if (parsed.type === 'text' && parsed.text) {
              accumulatedContent += parsed.text;
              if (parsed.tokens) setTokenCount(parsed.tokens);
            } else if (parsed.text) {
              accumulatedContent += parsed.text;
            }

            setSessions((prev) =>
              prev.map((s) =>
                s.id === targetSessionId
                  ? {
                      ...s,
                      messages: s.messages.map((m) =>
                        m.id === assistantMsgId
                          ? {
                              ...m,
                              content: accumulatedContent,
                              thoughts: [...activeThoughts],
                              currentAction: activeAction,
                              generatedImages: activeGeneratedTextures.length > 0 ? [...activeGeneratedTextures] : undefined,
                              exportBadge: activeExportBadge,
                              autoAppliedSummary: activeAutoAppliedSummary,
                              isThinking: true,
                            }
                          : m
                      ),
                    }
                  : s
              )
            );

            if (parsed.error) {
              accumulatedContent += `\n\n⚠️ 錯誤: ${parsed.error}`;
            }
          } catch (e) {}
        }
      }

      const totalElapsed = (Date.now() - startTime) / 1000;

      setSessions((prev) =>
        prev.map((s) =>
          s.id === targetSessionId
            ? {
                ...s,
                messages: s.messages.map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        content: accumulatedContent || '（已完成思考，無額外輸出）',
                        thoughts: [...activeThoughts],
                        generatedImages: activeGeneratedTextures.length > 0 ? [...activeGeneratedTextures] : undefined,
                        exportBadge: activeExportBadge,
                        autoAppliedSummary: activeAutoAppliedSummary,
                        isThinking: false,
                        elapsedSeconds: totalElapsed,
                      }
                    : m
                ),
              }
            : s
        )
      );

      if (currentUser) {
        const finalSession = {
          ...currentSession,
          title: sessionTitle,
          updatedAt: Date.now(),
          messages: [
            ...updatedMessages,
            {
              ...assistantMsg,
              content: accumulatedContent,
              thoughts: activeThoughts,
              generatedImages: activeGeneratedTextures.length > 0 ? [...activeGeneratedTextures] : undefined,
              exportBadge: activeExportBadge,
              autoAppliedSummary: activeAutoAppliedSummary,
              isThinking: false,
              elapsedSeconds: totalElapsed,
            },
          ],
        };
        saveChatToCloud(currentUser.uid, finalSession);
      }
    } catch (err: any) {
      console.error('Chat Stream Error:', err);
      const errMsg = `\n\n❌ **發生錯誤**: ${err.message || '無法取得 AI 回覆，請確認網路或稍後重試。'}`;
      setSessions((prev) =>
        prev.map((s) =>
          s.id === targetSessionId
            ? {
                ...s,
                messages: s.messages.map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        content: (m.content || '') + errMsg,
                        isThinking: false,
                      }
                    : m
                ),
              }
            : s
        )
      );
    } finally {
      setIsStreaming(false);
      setCurrentAction('已完成當前輪次生成');
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#212121] font-sans antialiased text-[#ececec]">
      {/* ChatGPT Sidebar with Expandable Module Folder Tree */}
      <Sidebar
        isOpen={sidebarOpen}
        onToggleOpen={() => setSidebarOpen(false)}
        projects={projects}
        activeProjectId={activeProjectId}
        onSelectProject={(id) => {
          setActiveProjectId(id);
          const firstProjSess = sessions.find((s) => s.projectId === id);
          if (firstProjSess) {
            setActiveSessionId(firstProjSess.id);
          } else {
            handleNewChatInProject(id);
          }
        }}
        onOpenCreateProject={() => setIsProjectModalOpen(true)}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={setActiveSessionId}
        onNewChatInProject={handleNewChatInProject}
        onDeleteSession={handleDeleteSession}
        onRenameSession={handleRenameSession}
        onDeleteProject={handleDeleteProject}
        onExportProject={handleExportProject}
        onViewComponent={(comp) => setInspectingComponent(comp)}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onOpenTextureModal={() => setIsTextureModalOpen(true)}
        currentUser={currentUser}
        onOpenAuth={() => {
          setAuthMode('login');
          setIsAuthModalOpen(true);
        }}
      />

      {/* Main ChatGPT Window */}
      <ChatWindow
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(true)}
        activeProject={activeProject}
        currentSession={currentSession}
        onSendMessage={handleSendMessage}
        isStreaming={isStreaming}
        onOpenThoughtInspector={() => setIsThoughtInspectorOpen(true)}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onExportAddon={() => activeProject && handleExportProject(activeProject)}
        onOpenProjectModal={() => setIsProjectModalOpen(true)}
        onAddComponentToProject={handleAddComponentToProject}
        onOpenTextureModal={(initTex) => {
          setInitialTextureForModal(initTex || null);
          setIsTextureModalOpen(true);
        }}
        isCloudSynced={Boolean(currentUser)}
        currentUser={currentUser}
        onOpenAuth={(mode) => {
          setAuthMode(mode || 'login');
          setIsAuthModalOpen(true);
        }}
      />

      {/* AI Minecraft Texture Studio Modal */}
      <TextureGeneratorModal
        isOpen={isTextureModalOpen}
        onClose={() => {
          setIsTextureModalOpen(false);
          setInitialTextureForModal(null);
        }}
        activeProject={activeProject || undefined}
        onSaveTextureToProject={handleAddComponentToProject}
        initialTexture={initialTextureForModal}
      />

      {/* Module Component / File Viewer Modal */}
      <ComponentViewModal
        component={inspectingComponent}
        onClose={() => setInspectingComponent(null)}
        onDeleteComponent={handleDeleteComponentFromProject}
        onAskAIAboutComponent={handleAskAIAboutComponent}
      />

      {/* Thought & Action Inspector Modal */}
      <ThoughtInspectorModal
        isOpen={isThoughtInspectorOpen}
        onClose={() => setIsThoughtInspectorOpen(false)}
        isStreaming={isStreaming}
        currentAction={currentAction}
        thoughtLogs={globalThoughtLogs}
        elapsedMs={elapsedMs}
        tokenCount={tokenCount}
      />

      {/* Auth & Cloud Storage Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        initialMode={authMode}
      />

      {/* Project Management Modal */}
      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        projects={projects}
        activeProjectId={activeProjectId}
        onCreateProject={handleCreateProject}
        onSelectProject={setActiveProjectId}
        onDeleteProject={handleDeleteProject}
      />

      {/* Addon Import Modal */}
      <AddonImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={handleImportSuccess}
      />
    </div>
  );
}
