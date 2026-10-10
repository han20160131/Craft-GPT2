import JSZip from 'jszip';
import { Project } from '../types/addon';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function exportProjectToMcAddon(project: Project): Promise<Blob> {
  const zip = new JSZip();

  const bpHeaderUUID = generateUUID();
  const bpModuleUUID = generateUUID();
  const rpHeaderUUID = generateUUID();
  const rpModuleUUID = generateUUID();

  const packName = project.name || 'CustomAddon';
  const bpFolder = zip.folder(`${packName}_BP`)!;
  const rpFolder = zip.folder(`${packName}_RP`)!;

  // 1. Behavior Pack Manifest
  const bpManifest = {
    format_version: 2,
    header: {
      name: `${project.name} [行為包]`,
      description: project.description || 'Crafted with CraftGPT',
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
      name: `${project.name} [材質包]`,
      description: project.description || 'Crafted with CraftGPT',
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
    `pack.name=${project.name}`,
    `pack.description=${project.description || ''}`,
  ];

  const itemTextureData: Record<string, { textures: string }> = {};
  let customReadmeWritten = false;

  project.components.forEach((comp) => {
    // 3.1 Check if this is README.md
    if (comp.filePath === 'README.md' || comp.type === 'doc') {
      zip.file('README.md', comp.contentJson);
      customReadmeWritten = true;
      return;
    }

    const rawId = comp.identifier.includes(':') 
      ? comp.identifier.split(':')[1] 
      : (comp.name || 'custom').toLowerCase().replace(/\s+/g, '_');

    // 3.2 Texture PNG
    if (comp.type === 'texture') {
      let base64Data = '';
      if (comp.imageDataUrl && comp.imageDataUrl.includes('base64,')) {
        base64Data = comp.imageDataUrl.split('base64,')[1];
      } else if (comp.contentJson && comp.contentJson.includes('base64,')) {
        base64Data = comp.contentJson.split('base64,')[1];
      } else if (comp.contentJson && !comp.contentJson.startsWith('{')) {
        base64Data = comp.contentJson;
      }

      if (base64Data) {
        const subPath = comp.filePath.startsWith('RP/') 
          ? comp.filePath.replace(/^RP\//, '') 
          : `textures/items/${rawId}.png`;
        rpFolder.file(subPath, base64Data, { base64: true });
        itemTextureData[rawId] = {
          textures: `textures/items/${rawId}`,
        };
        langEntries.push(`item.${project.namespace || 'custom'}:${rawId}.name=${comp.name}`);
      }
      return;
    }

    // 3.3 Explicit BP/ or RP/ paths
    if (comp.filePath.startsWith('BP/')) {
      const relPath = comp.filePath.replace(/^BP\//, '');
      bpFolder.file(relPath, comp.contentJson);
      return;
    }

    if (comp.filePath.startsWith('RP/')) {
      const relPath = comp.filePath.replace(/^RP\//, '');
      rpFolder.file(relPath, comp.contentJson);
      return;
    }

    // 3.4 Fallback based on type
    const fileName = `${rawId}.json`;
    let targetFolder = bpFolder;
    if (comp.type === 'item') {
      targetFolder = bpFolder.folder('items')!;
      langEntries.push(`item.${comp.identifier}.name=${comp.name}`);
      if (comp.imageDataUrl) {
        let base64Data = comp.imageDataUrl.includes('base64,') 
          ? comp.imageDataUrl.split('base64,')[1] 
          : comp.imageDataUrl;
        rpFolder.file(`textures/items/${rawId}.png`, base64Data, { base64: true });
        itemTextureData[rawId] = {
          textures: `textures/items/${rawId}`,
        };
      }
    } else if (comp.type === 'entity') {
      targetFolder = bpFolder.folder('entities')!;
      langEntries.push(`entity.${comp.identifier}.name=${comp.name}`);
    } else if (comp.type === 'block') {
      targetFolder = bpFolder.folder('blocks')!;
      langEntries.push(`tile.${comp.identifier}.name=${comp.name}`);
    } else if (comp.type === 'recipe') {
      targetFolder = bpFolder.folder('recipes')!;
    } else if (comp.type === 'function') {
      targetFolder = bpFolder.folder('functions')!;
    }

    targetFolder.file(fileName, comp.contentJson);
  });

  // Default README if none provided
  if (!customReadmeWritten) {
    const defaultReadme = `# ${project.name}

> 由 CraftGPT Minecraft 模組工作台自動建構之 Bedrock 模組

## 模組資訊
- 專案名稱: ${project.name}
- 命名空間: ${project.namespace}
- 包含組件數: ${project.components.length}

## 安裝指南
1. 直接在 Windows 雙擊 \`.mcaddon\` 檔案，Minecraft 將自動啟動並匯入行為包與資源包。
2. 進入世界設定，在「行為包」與「資源包」中同時啟用本模組。
3. 確保開啟「實驗性遊戲玩法」相關選項以獲得完整體驗！
`;
    zip.file('README.md', defaultReadme);
  }

  // If we have textures, write item_texture.json
  if (Object.keys(itemTextureData).length > 0) {
    const itemTextureJson = {
      resource_pack_name: project.name || 'CustomAddon',
      texture_name: 'atlas.items',
      texture_data: itemTextureData,
    };
    rpFolder.file('textures/item_texture.json', JSON.stringify(itemTextureJson, null, 2));
  }

  // Localization file
  const langContent = langEntries.join('\n');
  rpFolder.file('texts/en_US.lang', langContent);
  rpFolder.file('texts/zh_TW.lang', langContent);

  // Generate .mcaddon blob
  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/octet-stream',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return blob;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
