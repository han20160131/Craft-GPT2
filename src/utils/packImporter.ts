import JSZip from 'jszip';
import { AddonComponent } from '../types/addon';

export interface ImportResult {
  projectName?: string;
  description?: string;
  components: AddonComponent[];
  warning?: string;
}

// Clean Minecraft formatting codes like §6, §l, etc.
function stripFormatting(str: string): string {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/§[0-9a-fk-or]/gi, '').trim();
}

// Normalize path separators from Windows \ to standard /
export function normalizePath(p: string): string {
  return p.replace(/\\+/g, '/').replace(/^\/+/, '');
}

// Strip single/multi-line comments and trailing commas from Minecraft Bedrock JSON files
export function stripJsonCommentsAndTrailingCommas(jsonStr: string): string {
  if (!jsonStr) return '{}';
  // Remove BOM and common null/special bytes
  let cleaned = jsonStr.replace(/^\uFEFF/, '').replace(/\0/g, '');

  let inString = false;
  let stringChar = '';
  let isEscaped = false;
  let result = '';

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    const next = cleaned[i + 1];

    if (inString) {
      result += ch;
      if (isEscaped) {
        isEscaped = false;
      } else if (ch === '\\') {
        isEscaped = true;
      } else if (ch === stringChar) {
        inString = false;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = true;
      stringChar = ch;
      result += ch;
      continue;
    }

    // Single-line comment // or #
    if ((ch === '/' && next === '/') || ch === '#') {
      while (i < cleaned.length && cleaned[i] !== '\n' && cleaned[i] !== '\r') {
        i++;
      }
      result += cleaned[i] || '';
      continue;
    }

    // Multi-line comment /* */
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < cleaned.length && !(cleaned[i] === '*' && cleaned[i + 1] === '/')) {
        i++;
      }
      i++;
      continue;
    }

    result += ch;
  }

  // Remove trailing commas before } or ]
  result = result.replace(/,\s*([\}\]])/g, '$1');
  return result;
}

// Safe parse JSON with comment stripping & flexible fallback
export function safeJsonParse(text: string): any {
  if (!text || typeof text !== 'string') return null;
  try {
    return JSON.parse(text);
  } catch {
    try {
      const stripped = stripJsonCommentsAndTrailingCommas(text);
      return JSON.parse(stripped);
    } catch {
      return null;
    }
  }
}

// Check if raw bytes appear to be encrypted (e.g. Mojang Marketplace DRM or non-text binary)
function looksLikeEncryptedOrBinary(uint8: Uint8Array): boolean {
  if (!uint8 || uint8.length === 0) return false;
  // Sample first 1000 bytes
  const len = Math.min(uint8.length, 1000);
  let nonPrintableCount = 0;
  for (let i = 0; i < len; i++) {
    const b = uint8[i];
    // Check if byte is outside printable ASCII / UTF-8 text range and not newline/tab
    if (b < 9 || (b > 13 && b < 32)) {
      nonPrintableCount++;
    }
  }
  // If > 20% bytes are non-printable binary control chars, likely binary or encrypted
  return nonPrintableCount / len > 0.2;
}

// Classify a component based on its normalized path and parsed JSON
export function classifyComponent(
  relativePath: string,
  parsedJson: any,
  rawContent: string
): {
  type: AddonComponent['type'];
  identifier: string;
  name: string;
} {
  const normPath = normalizePath(relativePath);
  const baseName = normPath.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'unknown';
  let type: AddonComponent['type'] = 'other';
  let identifier = baseName;
  let name = baseName;

  if (normPath.endsWith('manifest.json') || normPath.toLowerCase().includes('manifest')) {
    type = 'manifest';
    identifier = parsedJson?.header?.uuid || 'manifest';
    name = parsedJson?.header?.name ? stripFormatting(parsedJson.header.name) : 'Pack Manifest';
    return { type, identifier, name };
  }

  if (normPath.endsWith('.mcfunction')) {
    return {
      type: 'function',
      identifier: baseName,
      name: baseName,
    };
  }

  if (normPath.endsWith('.lang')) {
    return {
      type: 'lang',
      identifier: baseName,
      name: baseName,
    };
  }

  if (normPath.endsWith('.md') || normPath.endsWith('.txt')) {
    return {
      type: 'doc',
      identifier: baseName,
      name: baseName,
    };
  }

  const lowerPath = normPath.toLowerCase();

  if (parsedJson) {
    if (parsedJson['minecraft:item']) {
      type = 'item';
      identifier = parsedJson['minecraft:item'].description?.identifier || identifier;
      name = parsedJson['minecraft:item'].components?.['minecraft:display_name']?.value || identifier;
    } else if (parsedJson['minecraft:entity']) {
      type = 'entity';
      identifier = parsedJson['minecraft:entity'].description?.identifier || identifier;
      name = identifier;
    } else if (parsedJson['minecraft:block']) {
      type = 'block';
      identifier = parsedJson['minecraft:block'].description?.identifier || identifier;
      name = identifier;
    } else if (parsedJson['minecraft:recipe_shaped'] || parsedJson['minecraft:recipe_shapeless'] || parsedJson['minecraft:recipe_furnace']) {
      type = 'recipe';
      identifier =
        parsedJson['minecraft:recipe_shaped']?.description?.identifier ||
        parsedJson['minecraft:recipe_shapeless']?.description?.identifier ||
        parsedJson['minecraft:recipe_furnace']?.description?.identifier ||
        identifier;
      name = identifier;
    } else if (parsedJson['minecraft:attachable'] || lowerPath.includes('attachables/')) {
      type = 'other';
      identifier = parsedJson?.['minecraft:attachable']?.description?.identifier || identifier;
      name = `${baseName} (Attachable)`;
    } else if (lowerPath.includes('items/')) {
      type = 'item';
    } else if (lowerPath.includes('blocks/') || lowerPath.endsWith('blocks.json')) {
      type = 'block';
    } else if (lowerPath.includes('entities/')) {
      type = 'entity';
    } else if (lowerPath.includes('recipes/')) {
      type = 'recipe';
    } else if (lowerPath.includes('textures/') || lowerPath.endsWith('_texture.json')) {
      type = 'texture';
    } else if (lowerPath.includes('loot_tables/')) {
      type = 'other';
      name = `${baseName} (戰利品表)`;
    } else if (lowerPath.includes('animations/') || lowerPath.includes('animation_controllers/')) {
      type = 'other';
      name = `${baseName} (動作控制器)`;
    } else if (lowerPath.includes('render_controllers/')) {
      type = 'other';
      name = `${baseName} (渲染控制器)`;
    } else if (lowerPath.includes('scripts/')) {
      type = 'other';
      name = `${baseName} (腳本)`;
    }
  } else {
    // If JSON parsing was strict-failed, still classify by folder name
    if (lowerPath.includes('items/')) type = 'item';
    else if (lowerPath.includes('blocks/')) type = 'block';
    else if (lowerPath.includes('entities/')) type = 'entity';
    else if (lowerPath.includes('recipes/')) type = 'recipe';
    else if (lowerPath.includes('attachables/')) type = 'other';
  }

  return {
    type,
    identifier,
    name: typeof name === 'string' ? stripFormatting(name) : identifier,
  };
}

export async function importAddonFile(file: File): Promise<ImportResult> {
  const fileName = file.name.toLowerCase();

  // 1. Single JSON file import
  if (fileName.endsWith('.json')) {
    const text = await file.text();
    const parsed = safeJsonParse(text);
    const classification = classifyComponent(file.name, parsed, text);

    return {
      projectName: file.name.replace('.json', ''),
      components: [
        {
          id: `comp-${Date.now()}`,
          type: classification.type,
          name: classification.name,
          identifier: classification.identifier,
          filePath: `${classification.type === 'other' ? '' : classification.type + 's/'}${file.name}`,
          contentJson: text,
        },
      ],
    };
  }

  // 2. .mcaddon / .mcpack / .zip archive import
  const outerZip = new JSZip();
  let loadedZip: JSZip;

  try {
    let zipData: any = file;
    if (typeof (file as any).arrayBuffer === 'function') {
      zipData = await (file as any).arrayBuffer();
    }
    loadedZip = await outerZip.loadAsync(zipData);
  } catch (zipErr: any) {
    throw new Error(`無法解壓縮此檔案，請確認是否為合法的 .mcaddon、.mcpack 或 .zip 壓縮包（錯誤: ${zipErr.message}）`);
  }

  const components: AddonComponent[] = [];
  let foundName = file.name.replace(/\.(mcaddon|mcpack|zip)$/i, '');
  let foundDesc = '';
  let encryptedFilesCount = 0;
  let totalFilesScanned = 0;

  // Helper to process a loaded JSZip instance and extract components
  async function processZipArchive(zipInstance: JSZip, prefixPath: string = '') {
    const entries = Object.keys(zipInstance.files);

    // 2.1 First check if there are nested .mcpack or .zip files (typical of official .mcaddon)
    for (const rawPath of entries) {
      const entry = zipInstance.files[rawPath];
      if (entry.dir) continue;

      const normalizedEntryPath = normalizePath(rawPath);
      const lowerName = normalizedEntryPath.toLowerCase();

      if (lowerName.endsWith('.mcpack') || (lowerName.endsWith('.zip') && !lowerName.includes('__macosx'))) {
        try {
          const nestedData = await entry.async('uint8array');
          const nestedZip = await JSZip.loadAsync(nestedData);

          // Determine pack prefix: BP or RP
          let subPrefix = prefixPath;
          if (lowerName.includes('_bp') || lowerName.includes('behavior') || lowerName.includes('/bp/') || lowerName.startsWith('bp/')) {
            subPrefix = 'BP/';
          } else if (lowerName.includes('_rp') || lowerName.includes('resource') || lowerName.includes('/rp/') || lowerName.startsWith('rp/')) {
            subPrefix = 'RP/';
          } else if (!subPrefix) {
            subPrefix = normalizedEntryPath.replace(/\.(mcpack|zip)$/i, '') + '/';
          }

          // Recursively process the nested pack
          await processZipArchive(nestedZip, subPrefix);
        } catch (nestedErr) {
          console.warn('Failed to unpack nested pack:', rawPath, nestedErr);
        }
      }
    }

    // 2.2 Process regular files in this zip instance
    for (const rawPath of entries) {
      const entry = zipInstance.files[rawPath];
      if (entry.dir) continue;

      const normalizedEntryPath = normalizePath(rawPath);
      const lowerName = normalizedEntryPath.toLowerCase();

      // Skip macos hidden files and nested zips already processed
      if (lowerName.includes('__macosx') || lowerName.endsWith('.ds_store')) continue;
      if (lowerName.endsWith('.mcpack')) continue;

      totalFilesScanned++;

      // Construct normalized full path
      let fullPath = normalizedEntryPath;
      if (prefixPath && !fullPath.startsWith(prefixPath)) {
        if (!fullPath.startsWith('BP/') && !fullPath.startsWith('RP/')) {
          fullPath = `${prefixPath}${fullPath}`;
        }
      }

      // 1. Text-based files (JSON, Lang, mcfunction, txt, md, js, ts)
      const isJson = lowerName.endsWith('.json') || lowerName.endsWith('.material') || lowerName.endsWith('.jsonc');
      const isFunction = lowerName.endsWith('.mcfunction');
      const isLang = lowerName.endsWith('.lang');
      const isDoc = lowerName.endsWith('.md') || lowerName.endsWith('.txt');
      const isScript = lowerName.endsWith('.js') || lowerName.endsWith('.ts');

      if (isJson || isFunction || isLang || isDoc || isScript) {
        try {
          const bytes = await entry.async('uint8array');
          
          // Check for DRM encryption
          if (isJson && looksLikeEncryptedOrBinary(bytes)) {
            encryptedFilesCount++;
            continue;
          }

          // Decode text safely using UTF-8 decoder with BOM handling
          const decoder = new TextDecoder('utf-8');
          const text = decoder.decode(bytes);
          const parsed = isJson ? safeJsonParse(text) : null;

          // Check manifest for pack title/description
          if (isJson && (lowerName.endsWith('manifest.json') || lowerName.includes('manifest'))) {
            if (parsed?.header?.name) {
              const cleanedName = stripFormatting(parsed.header.name);
              if (cleanedName && (!foundName || foundName === file.name.replace(/\.[^/.]+$/, ''))) {
                foundName = cleanedName;
              }
            }
            if (parsed?.header?.description && !foundDesc) {
              foundDesc = stripFormatting(parsed.header.description);
            }
          }

          const classification = classifyComponent(fullPath, parsed, text);

          components.push({
            id: `comp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            type: classification.type,
            name: classification.name,
            identifier: classification.identifier,
            filePath: fullPath,
            contentJson: text,
          });
        } catch (fileErr) {
          console.warn('Failed reading text file:', fullPath, fileErr);
        }
        continue;
      }

      // 2. PNG or TGA Textures
      if (lowerName.endsWith('.png') || lowerName.endsWith('.tga')) {
        try {
          const base64Data = await entry.async('base64');
          const dataUrl = `data:image/png;base64,${base64Data}`;
          const texName = normalizedEntryPath.split('/').pop()?.replace(/\.(png|tga)$/i, '') || 'texture';

          components.push({
            id: `comp-tex-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            type: 'texture',
            name: `${texName}.png`,
            identifier: `textures:${texName}`,
            filePath: fullPath,
            contentJson: dataUrl,
            imageDataUrl: dataUrl,
          });
        } catch (texErr) {
          console.warn('Failed reading texture:', fullPath, texErr);
        }
        continue;
      }
    }
  }

  // Start processing outer zip
  await processZipArchive(loadedZip, '');

  // Check if this was a protected / encrypted Marketplace addon
  if (components.length === 0 && encryptedFilesCount > 0) {
    throw new Error(
      `⚠️ 偵測到此模組包可能為 Minecraft 官方商城 (Marketplace) 加密模組（檢測到 ${encryptedFilesCount} 個加密二進制檔案）。\n\n` +
      `微軟/Mojang 對官方商城購買的付費 Add-on 採用專屬 DRM 金鑰加密，其檔案為二進制密文，外部工具無法直接解讀或修改。\n\n` +
      `💡 建議解決方式：\n` +
      `1. 請使用創作者發布之開源/非加密社群模組 (.mcaddon / .mcpack / .zip)。\n` +
      `2. 或直接在 CraftGPT 中讓 AI 從零為您打造相同功能的高清傳奇模組！`
    );
  }

  return {
    projectName: foundName,
    description: foundDesc,
    components,
  };
}

