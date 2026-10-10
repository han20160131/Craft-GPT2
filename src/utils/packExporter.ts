import JSZip from 'jszip';
import { Project, AddonComponent } from '../types/addon';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Sanitize folder/file names for zip
function sanitizeName(name: string): string {
  if (!name) return 'CustomAddon';
  return name.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_');
}

// Ensure content is always a valid string
function safeStringifyContent(content: any): string {
  if (content === null || content === undefined) return '{}';
  if (typeof content === 'string') return content;
  try {
    return JSON.stringify(content, null, 2);
  } catch {
    return String(content);
  }
}

// Build standard Bedrock project ZIP structure
export async function buildProjectZip(project: Project): Promise<JSZip> {
  const zip = new JSZip();

  const bpHeaderUUID = generateUUID();
  const bpModuleUUID = generateUUID();
  const rpHeaderUUID = generateUUID();
  const rpModuleUUID = generateUUID();

  const packName = sanitizeName(project.name);
  const bpFolder = zip.folder(`${packName}_BP`)!;
  const rpFolder = zip.folder(`${packName}_RP`)!;

  // 1. Behavior Pack Manifest
  const bpManifest = {
    format_version: 2,
    header: {
      name: `${project.name || 'Custom Mod'} [行為包]`,
      description: project.description || 'Crafted with CraftGPT Minecraft Studio',
      uuid: bpHeaderUUID,
      version: project.version || [1, 0, 0],
      min_engine_version: [1, 21, 0],
    },
    modules: [
      {
        type: 'data',
        uuid: bpModuleUUID,
        version: project.version || [1, 0, 0],
      },
    ],
    dependencies: [
      {
        uuid: rpHeaderUUID,
        version: project.version || [1, 0, 0],
      },
    ],
  };
  bpFolder.file('manifest.json', JSON.stringify(bpManifest, null, 2));

  // 2. Resource Pack Manifest
  const rpManifest = {
    format_version: 2,
    header: {
      name: `${project.name || 'Custom Mod'} [材質包]`,
      description: project.description || 'Crafted with CraftGPT Minecraft Studio',
      uuid: rpHeaderUUID,
      version: project.version || [1, 0, 0],
      min_engine_version: [1, 21, 0],
    },
    modules: [
      {
        type: 'resources',
        uuid: rpModuleUUID,
        version: project.version || [1, 0, 0],
      },
    ],
  };
  rpFolder.file('manifest.json', JSON.stringify(rpManifest, null, 2));

  // 3. Components categorization
  const langEntries: string[] = [
    `pack.name=${project.name || 'Custom Addon'}`,
    `pack.description=${project.description || 'Crafted with CraftGPT'}`,
  ];

  const itemTextureData: Record<string, { textures: string }> = {};
  const terrainTextureData: Record<string, { textures: string }> = {};
  let customReadmeWritten = false;

  const components = Array.isArray(project.components) ? project.components : [];

  components.forEach((comp) => {
    if (!comp) return;

    const rawPath = (comp.filePath || comp.name || 'component.json').replace(/\\+/g, '/');
    const content = safeStringifyContent(comp.contentJson);

    // 3.1 Check if this is README.md
    if (rawPath === 'README.md' || comp.type === 'doc') {
      zip.file('README.md', content);
      customReadmeWritten = true;
      return;
    }

    const rawId = comp.identifier && comp.identifier.includes(':')
      ? comp.identifier.split(':')[1]
      : (comp.name || 'custom').toLowerCase().replace(/\s+/g, '_');

    // 3.2 Texture PNG
    if (comp.type === 'texture' || rawPath.endsWith('.png')) {
      let base64Data = '';
      const srcUrl = comp.imageDataUrl || comp.contentJson || '';
      if (typeof srcUrl === 'string') {
        if (srcUrl.includes('base64,')) {
          base64Data = srcUrl.split('base64,')[1];
        } else if (!srcUrl.startsWith('{') && !srcUrl.startsWith('[') && srcUrl.length > 30) {
          base64Data = srcUrl;
        }
      }

      if (base64Data) {
        const subPath = rawPath.startsWith('RP/')
          ? rawPath.replace(/^RP\//, '')
          : `textures/items/${rawId}.png`;
        
        rpFolder.file(subPath, base64Data, { base64: true });

        if (subPath.includes('textures/blocks/')) {
          terrainTextureData[rawId] = {
            textures: `textures/blocks/${rawId}`,
          };
          langEntries.push(`tile.${project.namespace || 'custom'}:${rawId}.name=${comp.name || rawId}`);
        } else {
          itemTextureData[rawId] = {
            textures: `textures/items/${rawId}`,
          };
          langEntries.push(`item.${project.namespace || 'custom'}:${rawId}.name=${comp.name || rawId}`);
        }
      }
      return;
    }

    // 3.3 Explicit BP/ or RP/ paths
    if (rawPath.startsWith('BP/')) {
      const relPath = rawPath.replace(/^BP\//, '');
      bpFolder.file(relPath, content);
      return;
    }

    if (rawPath.startsWith('RP/')) {
      const relPath = rawPath.replace(/^RP\//, '');
      rpFolder.file(relPath, content);
      return;
    }

    // 3.4 Fallback based on type
    const fileName = `${rawId}.json`;
    let targetFolder = bpFolder;
    if (comp.type === 'item') {
      targetFolder = bpFolder.folder('items')!;
      langEntries.push(`item.${comp.identifier || `${project.namespace}:${rawId}`}.name=${comp.name || rawId}`);
      if (comp.imageDataUrl && comp.imageDataUrl.includes('base64,')) {
        const base64Data = comp.imageDataUrl.split('base64,')[1];
        rpFolder.file(`textures/items/${rawId}.png`, base64Data, { base64: true });
        itemTextureData[rawId] = {
          textures: `textures/items/${rawId}`,
        };
      }
    } else if (comp.type === 'entity') {
      targetFolder = bpFolder.folder('entities')!;
      langEntries.push(`entity.${comp.identifier || `${project.namespace}:${rawId}`}.name=${comp.name || rawId}`);
    } else if (comp.type === 'block') {
      targetFolder = bpFolder.folder('blocks')!;
      langEntries.push(`tile.${comp.identifier || `${project.namespace}:${rawId}`}.name=${comp.name || rawId}`);
      if (comp.imageDataUrl && comp.imageDataUrl.includes('base64,')) {
        const base64Data = comp.imageDataUrl.split('base64,')[1];
        rpFolder.file(`textures/blocks/${rawId}.png`, base64Data, { base64: true });
        terrainTextureData[rawId] = {
          textures: `textures/blocks/${rawId}`,
        };
      }
    } else if (comp.type === 'recipe') {
      targetFolder = bpFolder.folder('recipes')!;
    } else if (comp.type === 'function') {
      targetFolder = bpFolder.folder('functions')!;
    }

    targetFolder.file(fileName, content);
  });

  // Default README if none provided
  if (!customReadmeWritten) {
    const defaultReadme = `# ${project.name || 'Minecraft Add-on'}

> 由 CraftGPT Minecraft 模組工作台自動建構之 Bedrock 1.21+ 模組包

## 模組資訊
- 專案名稱: ${project.name || '未命名模組'}
- 命名空間: ${project.namespace || 'custom'}
- 包含組件數: ${components.length}

## 安裝指南
1. 直接在 Windows 雙擊 \`.mcaddon\` 檔案，Minecraft 基岩版將自動啟動並匯入行為包 (BP) 與資源包 (RP)。
2. 進入世界設定，在「行為包」與「資源包」中同時啟用本模組。
3. 確保開啟「實驗性遊戲玩法」(Experimental Gameplay) 相關選項以獲得完整體驗！
`;
    zip.file('README.md', defaultReadme);
  }

  // If we have item textures, write item_texture.json
  if (Object.keys(itemTextureData).length > 0) {
    const itemTextureJson = {
      resource_pack_name: project.name || 'CustomAddon',
      texture_name: 'atlas.items',
      texture_data: itemTextureData,
    };
    rpFolder.file('textures/item_texture.json', JSON.stringify(itemTextureJson, null, 2));
  }

  // If we have block textures, write terrain_texture.json
  if (Object.keys(terrainTextureData).length > 0) {
    const terrainTextureJson = {
      resource_pack_name: project.name || 'CustomAddon',
      texture_name: 'atlas.terrain',
      padding: 8,
      num_mip_levels: 4,
      texture_data: terrainTextureData,
    };
    rpFolder.file('textures/terrain_texture.json', JSON.stringify(terrainTextureJson, null, 2));
  }

  // Localization file
  const langContent = langEntries.join('\n');
  rpFolder.file('texts/en_US.lang', langContent);
  rpFolder.file('texts/zh_TW.lang', langContent);

  return zip;
}

// Export as standard all-in-one .mcaddon Blob
export async function exportProjectToMcAddon(project: Project): Promise<Blob> {
  const zip = await buildProjectZip(project);

  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/octet-stream',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return blob;
}

// Export as standard .zip Blob
export async function exportProjectToZip(project: Project): Promise<Blob> {
  const zip = await buildProjectZip(project);

  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return blob;
}

// Bulletproof Download Helper that avoids synchronous revokeObjectURL bug
export function downloadBlob(blob: Blob, filename: string) {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    
    // CRITICAL FIX: Do NOT revoke synchronously! Keep URL alive for 60 seconds
    // to allow Chrome, Edge, and Firefox to finish streaming the download.
    setTimeout(() => {
      try {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch {}
    }, 60000);
  } catch (err) {
    console.error('downloadBlob failed:', err);
    throw err;
  }
}

// Fallback: Trigger export via backend server endpoint to bypass iframe download restrictions
export async function downloadProjectViaServer(project: Project, format: 'mcaddon' | 'zip' = 'mcaddon') {
  const resp = await fetch('/api/export-addon', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project, format }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`伺服器匯出失敗 (${resp.status}): ${errText}`);
  }

  const blob = await resp.blob();
  const safeName = sanitizeName(project.name) || 'CustomAddon';
  downloadBlob(blob, `${safeName}.${format}`);
}
