import React, { useState, useMemo } from 'react';
import { 
  Folder, 
  FolderOpen, 
  ChevronRight, 
  ChevronDown, 
  FileCode, 
  Image as ImageIcon, 
  FileText, 
  BookOpen, 
  Package, 
  Download, 
  Search, 
  Sparkles,
  Layers,
  FileCheck
} from 'lucide-react';
import { Project, AddonComponent } from '../types/addon';

interface ProjectFolderTreeProps {
  project: Project;
  onViewComponent: (comp: AddonComponent) => void;
  onExportProject?: (project: Project) => void;
  className?: string;
  compact?: boolean;
}

interface TreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  component?: AddonComponent;
  children: Record<string, TreeNode>;
}

export const ProjectFolderTree: React.FC<ProjectFolderTreeProps> = ({
  project,
  onViewComponent,
  onExportProject,
  className = '',
  compact = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPaths, setExpandedPaths] = useState<Record<string, boolean>>({
    '': true,
    'BP': true,
    'BP/items': true,
    'BP/recipes': true,
    'RP': true,
    'RP/textures': true,
    'RP/textures/items': true,
    'RP/texts': true,
  });

  // Build the hierarchical tree ONLY from real project components (starts empty, builds incrementally!)
  const treeRoot = useMemo(() => {
    const root: TreeNode = {
      name: project.name || '模組專案',
      path: '',
      isFolder: true,
      children: {},
    };

    // Populate ONLY with real components present in project
    const components = project.components || [];

    components.forEach((comp) => {
      let fullPath = comp.filePath || '';
      if (!fullPath) {
        if (comp.type === 'texture') fullPath = `RP/textures/items/${comp.name}.png`;
        else if (comp.type === 'recipe') fullPath = `BP/recipes/${comp.name}.json`;
        else if (comp.type === 'doc') fullPath = `README.md`;
        else fullPath = `BP/${comp.type}s/${comp.name}.json`;
      }

      const segments = fullPath.split('/').filter(Boolean);
      let curr = root;

      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const isLast = i === segments.length - 1;
        const currentPath = segments.slice(0, i + 1).join('/');

        if (isLast) {
          curr.children[seg] = {
            name: seg,
            path: currentPath,
            isFolder: false,
            component: comp,
            children: {},
          };
        } else {
          if (!curr.children[seg]) {
            let label = seg;
            if (seg === 'BP') label = 'BP (行為包 Behavior Pack)';
            else if (seg === 'RP') label = 'RP (資源包 Resource Pack)';
            curr.children[seg] = {
              name: label,
              path: currentPath,
              isFolder: true,
              children: {},
            };
          }
          curr = curr.children[seg];
        }
      }
    });

    return root;
  }, [project]);

  const toggleFolder = (path: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedPaths((prev) => ({
      ...prev,
      [path]: prev[path] === undefined ? false : !prev[path],
    }));
  };

  const expandAll = () => {
    const allPaths: Record<string, boolean> = { '': true };
    const traverse = (node: TreeNode) => {
      if (node.isFolder) {
        allPaths[node.path] = true;
        Object.values(node.children).forEach(traverse);
      }
    };
    traverse(treeRoot);
    setExpandedPaths(allPaths);
  };

  const collapseAll = () => {
    setExpandedPaths({ '': true });
  };

  // Render a tree node recursively
  const renderNode = (node: TreeNode, depth: number = 0) => {
    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesSelf = node.name.toLowerCase().includes(q) || node.path.toLowerCase().includes(q);
      const hasMatchingChild = (n: TreeNode): boolean => {
        if (n.name.toLowerCase().includes(q) || n.path.toLowerCase().includes(q)) return true;
        return Object.values(n.children).some(hasMatchingChild);
      };
      if (!matchesSelf && !hasMatchingChild(node)) {
        return null;
      }
    }

    if (node.isFolder) {
      const isExpanded = expandedPaths[node.path] !== false;
      const childCount = Object.keys(node.children).length;
      const isRoot = node.path === '';
      const isBP = node.path === 'BP';
      const isRP = node.path === 'RP';

      return (
        <div key={node.path || 'root'} className="select-none">
          {!isRoot && (
            <div
              onClick={(e) => toggleFolder(node.path, e)}
              style={{ paddingLeft: `${Math.max(4, depth * 14)}px` }}
              className={`flex items-center justify-between py-1 px-1.5 rounded-lg cursor-pointer transition-colors group ${
                isBP 
                  ? 'hover:bg-emerald-950/40 text-emerald-300 font-semibold text-xs' 
                  : isRP 
                    ? 'hover:bg-cyan-950/40 text-cyan-300 font-semibold text-xs'
                    : 'hover:bg-[#252525] text-neutral-300 text-xs'
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <button
                  type="button"
                  onClick={(e) => toggleFolder(node.path, e)}
                  className="p-0.5 rounded text-neutral-400 group-hover:text-white"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
                  )}
                </button>

                {isExpanded ? (
                  <FolderOpen className={`w-3.5 h-3.5 shrink-0 ${
                    isBP ? 'text-emerald-400' : isRP ? 'text-cyan-400' : 'text-amber-400'
                  }`} />
                ) : (
                  <Folder className={`w-3.5 h-3.5 shrink-0 ${
                    isBP ? 'text-emerald-500' : isRP ? 'text-cyan-500' : 'text-amber-500'
                  }`} />
                )}

                <span className="truncate">{node.name}</span>
              </div>

              <span className="text-[10px] font-mono text-neutral-500 px-1 py-0.2 rounded bg-[#1e1e1e] shrink-0">
                {childCount}
              </span>
            </div>
          )}

          {/* Children container */}
          {(isRoot || isExpanded) && (
            <div className={!isRoot ? 'space-y-0.5' : 'space-y-0.5'}>
              {isRoot && Object.keys(node.children).length === 0 ? (
                <div className="py-4 px-3 text-center border border-dashed border-[#2d2d2d] rounded-lg my-1 bg-[#121212]">
                  <Layers className="w-5 h-5 text-neutral-500 mx-auto mb-1.5 opacity-60" />
                  <div className="text-xs font-medium text-neutral-300">模組資料夾目前為空白</div>
                  <div className="text-[11px] text-neutral-500 mt-1 leading-relaxed">
                    尚未建立檔案。向 CraftGPT 提出需求，AI 將會自主在此動態建立所需的 BP 或 RP 檔案！
                  </div>
                </div>
              ) : (
                Object.entries(node.children).map(([_, child]) => renderNode(child, depth + 1))
              )}
            </div>
          )}
        </div>
      );
    }

    // File Node
    const comp = node.component;
    const isImage = node.name.endsWith('.png') || comp?.type === 'texture';
    const isReadme = node.name === 'README.md' || comp?.type === 'doc';
    const isJson = node.name.endsWith('.json');
    const isLang = node.name.endsWith('.lang');

    return (
      <div
        key={node.path}
        onClick={() => comp && onViewComponent(comp)}
        style={{ paddingLeft: `${Math.max(16, depth * 14)}px` }}
        className={`flex items-center justify-between py-1 px-1.5 rounded-lg text-xs cursor-pointer transition-colors group ${
          comp 
            ? 'hover:bg-[#232323] text-neutral-200' 
            : 'text-neutral-500 hover:text-neutral-300'
        }`}
        title={comp ? `點擊檢視 ${node.path}` : `${node.path} (尚未建立檔案)`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {/* File Icon */}
          {isImage ? (
            comp?.imageDataUrl ? (
              <div className="w-4 h-4 rounded bg-black/60 border border-[#333] flex items-center justify-center p-0.5 shrink-0 overflow-hidden shadow-sm">
                <img 
                  src={comp.imageDataUrl} 
                  alt={node.name} 
                  className="w-3.5 h-3.5 object-contain"
                  style={{ imageRendering: 'pixelated' }}
                />
              </div>
            ) : (
              <ImageIcon className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            )
          ) : isReadme ? (
            <BookOpen className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          ) : isJson ? (
            <FileCode className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          ) : isLang ? (
            <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          ) : (
            <FileCheck className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
          )}

          <span className={`truncate ${
            isImage ? 'text-cyan-300 font-medium' : isReadme ? 'text-emerald-300 font-medium' : 'text-neutral-300'
          }`}>
            {node.name}
          </span>
        </div>

        {comp && (
          <div className="flex items-center gap-1 shrink-0">
            {isImage && (
              <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-800/40">
                {comp.textureData?.width || 32}x{comp.textureData?.height || 32} HD
              </span>
            )}
            <span className="text-[9px] font-mono uppercase px-1 py-0.2 rounded bg-[#1e1e1e] text-neutral-400 border border-[#2a2a2a] group-hover:border-neutral-500">
              {comp.type}
            </span>
          </div>
        )}
      </div>
    );
  };

  const totalFiles = (project.components || []).length;

  return (
    <div className={`flex flex-col bg-[#141414] rounded-xl border border-[#262626] overflow-hidden ${className}`}>
      {/* Header bar */}
      <div className="p-2.5 bg-[#181818] border-b border-[#262626] flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Package className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="min-w-0">
            <div className="text-xs font-semibold text-white truncate flex items-center gap-1.5">
              <span>{project.name}</span>
              <span className="text-[10px] text-neutral-400 font-mono font-normal">
                ({totalFiles} 個檔案)
              </span>
            </div>
            <div className="text-[10px] text-neutral-500 truncate font-mono">
              BP & RP 基岩版標準資料夾
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={expandAll}
            className="px-1.5 py-1 text-[10px] text-neutral-400 hover:text-white rounded hover:bg-[#252525] transition-colors"
            title="全部展開"
          >
            展開
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="px-1.5 py-1 text-[10px] text-neutral-400 hover:text-white rounded hover:bg-[#252525] transition-colors"
            title="全部收合"
          >
            收合
          </button>
          {onExportProject && (
            <button
              type="button"
              onClick={() => onExportProject(project)}
              className="p-1 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 hover:text-white transition-colors"
              title="匯出此模組 (.mcaddon)"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Search Input if needed */}
      {!compact && (
        <div className="px-2.5 py-1.5 bg-[#161616] border-b border-[#222]">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜尋模組資料夾與檔案..."
              className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg pl-7 pr-2 py-1 text-[11px] text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
        </div>
      )}

      {/* Main Folder Tree Content */}
      <div className="p-2 overflow-y-auto max-h-72 space-y-0.5 font-sans">
        {renderNode(treeRoot, 0)}
      </div>

      {/* Bottom Info note */}
      <div className="px-2.5 py-1.5 bg-[#121212] border-t border-[#222] text-[10px] text-neutral-500 flex items-center justify-between">
        <span className="flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-emerald-400" />
          <span>向 AI 說出需求，會自動建構檔案寫入目錄</span>
        </span>
        <span className="font-mono text-neutral-400">Bedrock 1.21+</span>
      </div>
    </div>
  );
};
